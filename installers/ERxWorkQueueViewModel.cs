using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Cryptography.X509Certificates;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using DevExpress.Mvvm;
using SoftWriters.FrameworkLtc.ApiCalls;
using SoftWriters.FrameworkLtc.ApiCalls.ERx;
using SoftWriters.FrameworkLtc.ApiCalls.Facility;
using SoftWriters.FrameworkLtc.ApiCalls.Facility.Facilities;
using SoftWriters.FrameworkLtc.ApiCalls.Patient;
using SoftWriters.FrameworkLtc.ApiCalls.Pharmacy;
using SoftWriters.FrameworkLtc.Common.Infrastructure;
using SoftWriters.FrameworkLtc.Common.Infrastructure.Extensions;
using SoftWriters.FrameworkLtc.Common.Services;
using SoftWriters.FrameworkLtc.Infrastructure;
using SoftWriters.FrameworkLtc.Infrastructure.AppState;
using SoftWriters.FrameworkLtc.Infrastructure.Commands;
using SoftWriters.FrameworkLtc.Infrastructure.Help;
using SoftWriters.FrameworkLtc.Interop;
using SoftWriters.FrameworkLtc.Messages;
using SoftWriters.FrameworkLtc.Messages.RX;
using SoftWriters.FrameworkLtc.Models.ERx;
using SoftWriters.FrameworkLtc.Models.Enums;
using SoftWriters.FrameworkLtc.Models.Enums.ERx;
using SoftWriters.FrameworkLtc.Models.Facility;
using SoftWriters.FrameworkLtc.Models.Infrastructure.Extensions;
using SoftWriters.FrameworkLtc.Models.Patient;
using SoftWriters.FrameworkLtc.Models.Pharmacy;
using SoftWriters.FrameworkLtc.Models.Shared;
using SoftWriters.FrameworkLtc.Models.SystemOptions;
using SoftWriters.FrameworkLtc.Services;
using SoftWriters.FrameworkLtc.Services.ERx;
using SoftWriters.FrameworkLtc.Services.Reports;
using SoftWriters.FrameworkLtc.ViewModels.Facility.PatientRxHistory;
using SoftWriters.FrameworkLtc.ViewModels.Printing;
using SoftWriters.FrameworkLtc.Views.Prescriptions.ERxWorkQueue;
using SoftWriters.FrameworkLtc.Views.Printing;

namespace SoftWriters.FrameworkLtc.ViewModels.Prescriptions.ERxWorkQueue;

public class ERxWorkQueueViewModel : LtcViewModelBase<ERxWorkQueueViewModel>, IERxWorkQueuePageViewModel
{
	private const string ERxTriageFunctionalityEnabledButNoAccess = "The E-Rx triage functionality is enabled, but you have not been given access to any folders.";

	private const string ProcessRequestCommandCaption = "_Process Request";

	private const string ErrorDialogTitle = "Error";

	private const string UnexpectedMessageDialogTitle = "FrameworkLTC";

	private const string NoMoreMessagesInQueue = "No more requests in queue...";

	private const string ErrorQueueConnectFailed = "ERROR: Failed to initialize connection to E-Rx.";

	private const string ErrorQueueUnknownException = "ERROR: Unknown exception in retrieving E-Rx message.";

	private const string ErrorQueueAssignmentException = "ERROR: Unable to retrieve E-Rx Work Queue assignment.";

	private const string ErrorQueueConfigurationException = "ERROR: Failed to configure connection to E-Rx.";

	private const string HL7WarningMessage = "This message was communicated using the HL7 protocol and may\r\nnot be considered sufficient for Medicare Part D prescriptions.";

	private const string CertificateNotAvailable = "Certificate not available.";

	private const string RefuseRequestNoPrompt = "Refusing this request will delete it from the queue, and it will no longer be available for processing. Are you sure that you want to continue?";

	private const string ChangeFolderInClip = "All items in this clip have not been processed. If you change folders, the remaining items will be placed back into the queue. Are you sure that you wish to continue?";

	private const string ChangeFolderInClipTitle = "Abort Processing";

	public const string VerifyDiscontinue = "Are you sure that you wish to discontinue Ro# {0} ({1})?";

	public const string VerifyDiscontinueTitle = "D/C Order";

	private const string ProcessTimeExpiredMessage = "The processing time for ERx messages has exceeded the allowed limit. ERx Work Queue is now closed, and the order you were working on has been returned to the incoming queue.";

	private readonly IERxWorkQueueService _erxWorkQueueService;

	private readonly IApiCallExecutor _apiCallExecutor;

	private readonly IMessageBoxService _messageBoxService;

	private readonly IERxMessageToViewModelService _eRxMessageToViewModelService;

	private readonly IERxMessageService _erxMessageService;

	private readonly IXmlPrintService _xmlPrintService;

	private readonly IExceptionLogger _exceptionLogger;

	private readonly IMessenger _messenger;

	private readonly IFwDispatcher _dispatcher;

	private readonly IShowWindowService _showWindowService;

	private readonly IAppUserInfo _appUserInfo;

	private readonly ILtcOptions _ltcOptions;

	private readonly ICurrentPrinterViewModel _currentPrinter;

	private readonly IWindowInteropUtility _windowInteropUtility;

	private readonly IFwDateTime _fwDateTime;

	private readonly IChangeFacilityService _changeFacilityService;

	private bool _dataLoaded;

	private IERxWorkQueueWizardViewModel _wizardViewModel;

	private ERxNewRxRequestMessageData _newRxRequestMessageData;

	private ERxRefillResponseMessageData _refillResponseMessageData;

	private ERxCancelMessageData _cancelRequestMessageData;

	private ERxResupplyMessageData _resupplyMessageData;

	private ERxRxFillIndicatorChangeMessageData _rxFillIndicatorChangeMessageData;

	private ERxRecertificationMessageData _recertificationMessageData;

	private ERxHL7MessageData _hl7RxMessageData;

	private DispatcherTimer _pollingTimer;

	private int _eRxWorkQueueDisconnectMinutes;

	private static SemaphoreSlim _semaphore;

	private DateTime? _assignmentLastRefreshed;

	private bool _inProcessingTimeExpired;

	public virtual string Title { get; set; }

	public virtual GenericComboBoxModel CurrentFolder { get; set; }

	public virtual bool ShowFolderFrame { get; set; }

	public virtual bool MultipleERxWorkQueueFolders { get; set; }

	public virtual ObservableCollection<ERxDataItemViewModel> ERxData { get; set; }

	public virtual DateTime? MessageEntryDate { get; set; }

	public virtual string MessageTypeDisplay { get; set; }

	public virtual ERxMessageTypes? ERxMessageType { get; set; }

	public virtual string ClipLabel { get; set; }

	public virtual string MessageId { get; set; }

	public virtual bool ShowHL7Warning { get; set; }

	public virtual string HL7WarningText { get; set; }

	public virtual bool ShowEPCSMessage { get; set; }

	public virtual bool ShowEPCSCertificate { get; set; }

	public virtual string EPCSMessageText { get; set; }

	public virtual bool EPCSSignatureValid { get; set; }

	public virtual IAsyncCommand ChangeFolderCommand { get; set; }

	public virtual IAsyncCommand PrintCommand { get; set; }

	public virtual IAsyncCommand ShowCertificateCommand { get; set; }

	private bool ProcessFromECM { get; set; }

	public ERxWorkQueueMessageModel ErxMessage { get; set; }

	private List<ERxDataItemViewModel> ErxMessageAsList { get; set; }

	private List<GenericComboBoxModel> ERxWorkQueueFolders { get; set; }

	private string LoggedInPharmacistNpi { get; set; }

	public bool InClipProcess { get; set; }

	private ERxWorkQueueMessageModel CurrentMessage { get; set; }

	private bool _signaturePresent { get; set; }

	private string _messageInterface { get; set; }

	private string _mailboxId { get; set; }

	private string _msgPharmId { get; set; }

	public ERxWorkQueueProcessModel ProcessModel { get; set; }

	public virtual bool ShowViewFlag { get; set; }

	public ERxWorkQueueViewModel(IERxWorkQueueService erxWorkQueueService, IApiCallExecutor apiCallExecutor, IMessageBoxService messageBoxService, IERxMessageToViewModelService erxMessageToViewModelService, IERxMessageService erxMessageService, IXmlPrintService xmlPrintService, IExceptionLogger exceptionLogger, IMessenger messenger, IShowWindowService showWindowService, IAppUserInfo appUserInfo, ILtcOptions ltcOptions, ICurrentPrinterViewModel currentPrinter, IFwDispatcher dispatcher, IWindowInteropUtility windowInteropUtility, IFwDateTime fwDateTime, IChangeFacilityService changeFacilityService)
	{
		_erxWorkQueueService = erxWorkQueueService;
		_apiCallExecutor = apiCallExecutor;
		_messageBoxService = messageBoxService;
		_eRxMessageToViewModelService = erxMessageToViewModelService;
		_erxMessageService = erxMessageService;
		_xmlPrintService = xmlPrintService;
		_exceptionLogger = exceptionLogger;
		_messenger = messenger;
		_showWindowService = showWindowService;
		_appUserInfo = appUserInfo;
		_ltcOptions = ltcOptions;
		_currentPrinter = currentPrinter;
		_dispatcher = dispatcher;
		_windowInteropUtility = windowInteropUtility;
		_fwDateTime = fwDateTime;
		PrintCommand = new AsyncDelegateCommand(Print);
		ChangeFolderCommand = new AsyncDelegateCommand(ChangeFolder);
		ShowCertificateCommand = new AsyncDelegateCommand(ShowCertificate);
		ERxData = new ObservableCollection<ERxDataItemViewModel>();
		_semaphore = new SemaphoreSlim(1, 1);
		_changeFacilityService = changeFacilityService;
	}

	public void SetFromECMData(bool fromECM, ERxWorkQueueMessageModel msg)
	{
		ProcessFromECM = fromECM;
		ErxMessage = msg;
	}

	private async Task SetFolder()
	{
		CurrentFolder = new GenericComboBoxModel
		{
			Id = ""
		};
		SystemOptionModel val = _apiCallExecutor.ExecuteSync(new GetSystemOptionByName((SystemOptionNames)179));
		if (val != null && val.ValueAsBoolean())
		{
			ERxWorkQueueFolders = await _apiCallExecutor.ExecuteAsync(new GetERxWorkQueueAllowableFolders(LoggedInPharmacistNpi));
			if (!ERxWorkQueueFolders.Any())
			{
				MessageBoxServicePlatformExtensions.Show(_messageBoxService, "The E-Rx triage functionality is enabled, but you have not been given access to any folders.", "Error", (MessageBoxButton)0, (MessageBoxImage)16);
				CurrentFolder = new GenericComboBoxModel
				{
					Id = "NOFOLDER"
				};
			}
			else if (ERxWorkQueueFolders.Count == 1)
			{
				CurrentFolder = ERxWorkQueueFolders.First();
			}
			else
			{
				CurrentFolder = _showWindowService.ShowDialog<ERxSelectFolderModalView, ERxSelectFolderModalViewModel, GenericComboBoxModel>((ILtcViewModelBase)this, (Action<ERxSelectFolderModalViewModel>)((ERxSelectFolderModalViewModel vm) =>
				{
					vm.AvailableFolders = ERxWorkQueueFolders;
				}));
			}
		}
		ShowFolderFrame = !string.IsNullOrEmpty(CurrentFolder.Id.ToString()) && CurrentFolder.Id.ToString() != "NOFOLDER";
		MultipleERxWorkQueueFolders = ERxWorkQueueFolders != null && ERxWorkQueueFolders.Count() > 1;
	}

	private async Task ChangeFolder()
	{
		if (InClipProcess && (int)MessageBoxServicePlatformExtensions.Show(_messageBoxService, "All items in this clip have not been processed. If you change folders, the remaining items will be placed back into the queue. Are you sure that you wish to continue?", "Abort Processing", (MessageBoxButton)4, (MessageBoxImage)48) != 6)
		{
			return;
		}
		GenericComboBoxModel val = await _showWindowService.ShowMdiDialog<ERxSelectFolderView, ERxSelectFolderModalViewModel, GenericComboBoxModel>((ILtcViewModelBase)this, (Action<ERxSelectFolderModalViewModel>)((ERxSelectFolderModalViewModel vm) =>
		{
			vm.AvailableFolders = ERxWorkQueueFolders;
		}), (Point?)null);
		if (val != null && CurrentFolder.Id.ToString() != val.Id.ToString())
		{
			CurrentFolder = val;
			if (!ProcessFromECM)
			{
				CurrentMessage = null;
				await DequeueNextMessage();
			}
			else
			{
				CloseView();
			}
		}
	}

	private async void PollingTimer_Tick(object sender, EventArgs e)
	{
		if (_inProcessingTimeExpired)
		{
			return;
		}
		if (CurrentMessage != null)
		{
			_inProcessingTimeExpired = true;
			try
			{
				TimeSpan? lastInputTimeSpan = _windowInteropUtility.GetLastInputTimeSpan();
				if (lastInputTimeSpan.HasValue && lastInputTimeSpan.Value.TotalSeconds < (double)(_eRxWorkQueueDisconnectMinutes * 60))
				{
					if (!_assignmentLastRefreshed.HasValue || _assignmentLastRefreshed.Value.AddMilliseconds(120000.0) < _fwDateTime.Now)
					{
						ERxAssignmentExpirationModel assignExpiration = await _apiCallExecutor.ExecuteAsync(new UpdateERxQueueAssignmentExpiration(new ERxUpdateAssignmentExpirationModel
						{
							AssignedTokenId = CurrentMessage.AssignedTokenId,
							MessageId = new Guid(MessageId),
							AssignDuration = (int)TimeSpan.FromMinutes(5.0).TotalSeconds
						}));
						if (assignExpiration == null)
						{
							await CompleteCurrentAndDequeueNextMessage();
							return;
						}
						if (assignExpiration.IsSuccess)
						{
							_assignmentLastRefreshed = _fwDateTime.Now;
							return;
						}
						MessengerExtensions.Send<ERxQueueTimedOutMessage>(_messenger, new ERxQueueTimedOutMessage());
						await _changeFacilityService.ForceChangeFacility("", true);
						MessageBoxServiceExtensions.ShowMessage(_messageBoxService, assignExpiration.ErrorMessage, "Error", (MessageButton)0, (MessageIcon)1);
					}
				}
				else
				{
					if (!(await _apiCallExecutor.ExecuteAsync(new HasRxBeenSavedOnProcessingMessage(new Guid(MessageId)))))
					{
						await _erxMessageService.CancelWork();
					}
					else
					{
						await _apiCallExecutor.ExecuteAsync(new MarkMessageAsProcessed(new MarkMessageAsProcessedRequestModel
						{
							Id = new Guid(MessageId),
							UserName = _appUserInfo.UserName
						}));
						await _erxMessageService.DequeueCompleted();
					}
					MessengerExtensions.Send<ERxQueueTimedOutMessage>(_messenger, new ERxQueueTimedOutMessage());
					await _changeFacilityService.ForceChangeFacility("", true);
					MessageBoxServiceExtensions.ShowMessage(_messageBoxService, "The processing time for ERx messages has exceeded the allowed limit. ERx Work Queue is now closed, and the order you were working on has been returned to the incoming queue.", "Processing Time Expired", (MessageButton)0, (MessageIcon)4);
				}
				return;
			}
			finally
			{
				_inProcessingTimeExpired = false;
			}
		}
		await DequeueNextMessage();
	}

	public async Task CompleteCurrentAndDequeueNextMessage()
	{
		CurrentMessage = null;
		await DequeueNextMessage(fromCompletedWork: true);
	}

	public async Task DequeueNextMessage(bool fromCompletedWork = false)
	{
		await _semaphore.WaitAsync();
		bool exceptionRequiresNewMessage = false;
		try
		{
			if (CurrentMessage == null)
			{
				string error = "";
				string errorTitle = "Error";
				ERxWorkQueueMessageModel msg = null;
				if (IsClosed)
				{
					return;
				}
				try
				{
					msg = await _erxMessageService.GetNextWork(LoggedInPharmacistNpi, CurrentFolder.Id.ToString(), fromCompletedWork);
				}
				catch (ConnectionFailedException ex)
				{
					_exceptionLogger.LogException(ex);
					error = "ERROR: Failed to initialize connection to E-Rx.";
				}
				catch (AssignmentFailedException ex2)
				{
					_exceptionLogger.LogException(ex2);
					error = "ERROR: Unable to retrieve E-Rx Work Queue assignment.";
				}
				catch (MessageNotFoundException)
				{
					exceptionRequiresNewMessage = true;
				}
				catch (ConfigurationException ex4)
				{
					_exceptionLogger.LogException(ex4);
					error = "ERROR: Failed to configure connection to E-Rx.";
				}
				catch (Exception ex5)
				{
					_exceptionLogger.LogException(ex5);
					error = "ERROR: Unknown exception in retrieving E-Rx message.";
				}
				if (!string.IsNullOrWhiteSpace(error))
				{
					MessageBoxServicePlatformExtensions.Show(_messageBoxService, error, errorTitle, (MessageBoxButton)0, (MessageBoxImage)16);
				}
				if (!exceptionRequiresNewMessage)
				{
					await LoadMessage(msg);
				}
			}
		}
		finally
		{
			_semaphore.Release();
			if (exceptionRequiresNewMessage)
			{
				await DequeueNextMessage();
			}
		}
	}

	private async Task ShowCertificate()
	{
		string text = await _apiCallExecutor.ExecuteAsync(new GetCertificateByErxMessageId(MessageId));
		if (string.IsNullOrEmpty(text))
		{
			MessageBoxServicePlatformExtensions.Show(_messageBoxService, "Certificate not available.", "", (MessageBoxButton)0, (MessageBoxImage)64);
		}
		else
		{
			X509Certificate2UI.DisplayCertificate(new X509Certificate2(Convert.FromBase64String(text)));
		}
	}

	private async Task Print()
	{
		_currentPrinter.SetPrinter(_ltcOptions.ERxPrinterName, _ltcOptions.ERxPaperBin);
		PrinterModel val = await _showWindowService.ShowMdiDialog<ConfirmPrinterView, ConfirmPrinterViewModel, PrinterModel>((ILtcViewModelBase)this, (Action<ConfirmPrinterViewModel>)((ConfirmPrinterViewModel vm) =>
		{
			vm.CurrentPrinterViewModel = _currentPrinter;
			vm.Title = "Print Request";
			vm.OKButtonText = "_Print";
		}), (Point?)null);
		if (val != null && !string.IsNullOrEmpty(val.DeviceName))
		{
			_currentPrinter.SetPrinter(val.DeviceName, val.PaperBin);
			string description = CommonEnumExtensions.GetDescription((Enum)(object)CurrentMessage.MsgType);
			_xmlPrintService.PrintERxData(description, ERxData, val.DeviceName, val.PaperBin);
			SaveReportSettings();
		}
	}

	private void SaveReportSettings()
	{
		_ltcOptions.ERxPaperBin = _currentPrinter.PaperBin;
		_ltcOptions.ERxPrinterName = _currentPrinter.DeviceName;
	}

	private async Task LoadMessage(ERxWorkQueueMessageModel msg)
	{
		List<ERxDataItemViewModel> message = null;
		ERxData.Clear();
		ShowEPCSMessage = false;
		ShowEPCSCertificate = false;
		EPCSSignatureValid = false;
		ShowHL7Warning = false;
		MessageTypeDisplay = "";
		bool enableProcess = true;
		bool enableRefuse = true;
		_messageInterface = "";
		_mailboxId = "";
		_signaturePresent = false;
		if (msg == null)
		{
			message = new List<ERxDataItemViewModel>
			{
				new ERxDataItemViewModel
				{
					Title = "",
					Value = "No more requests in queue...",
					IsGroupHeader = false,
					IsHighlighted = false
				}
			};
			enableProcess = false;
			enableRefuse = false;
		}
		else
		{
			bool signatureFlag = false;
			ERxMessageModel messageData = await _apiCallExecutor.ExecuteAsync(new GetERxMessageById(new Guid(msg.MsgId)));
			if (messageData != null)
			{
				_messageInterface = messageData.Interface;
				_mailboxId = ((messageData.FWLink == true) ? EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)3) : messageData.MailboxId);
			}
			_msgPharmId = msg.PharmId;
			try
			{
				ERxMessageTypes? msgType = msg.MsgType;
				if (msgType.HasValue)
				{
					ERxMessageTypes valueOrDefault = msgType.GetValueOrDefault();
					switch (valueOrDefault - 1)
					{
					case 4:
						MessageTypeDisplay = "New Prescription Request";
						_newRxRequestMessageData = _eRxMessageToViewModelService.GetERxNewRxRequestMessageData((ERxMessageTypes)5, msg.RawMessage);
						if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), _messageInterface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0 && string.IsNullOrEmpty(_newRxRequestMessageData.SPI))
						{
							_newRxRequestMessageData.SPI = messageData.SenderId;
						}
						message = _eRxMessageToViewModelService.GetViewModelsFromRxMessage(msg.RawMessage, out signatureFlag);
						await CheckForSignature(msg.MsgId, msg.MsgType.Value, signatureFlag, messageData);
						break;
					case 0:
						MessageTypeDisplay = "Cancel Order Request";
						_cancelRequestMessageData = _eRxMessageToViewModelService.GetCancelMessageData((ERxMessageTypes)1, msg.RawMessage);
						_cancelRequestMessageData.CancelMsgID = new Guid(msg.MsgId);
						_cancelRequestMessageData.PharmID = _msgPharmId;
						_cancelRequestMessageData.Interface = _messageInterface;
						_cancelRequestMessageData.MailboxId = _mailboxId;
						await _erxWorkQueueService.LookupCancelRxRequest(_cancelRequestMessageData);
						message = _eRxMessageToViewModelService.GetViewModelsFromRxCancelRequestMessage(_cancelRequestMessageData, msg.RawMessage);
						break;
					case 6:
					case 9:
					{
						MessageTypeDisplay = (((int)msg.MsgType.GetValueOrDefault() == 7) ? "Electronic Prescription (REFRES)" : "Renewal Response");
						string statusCode = "";
						_refillResponseMessageData = _eRxMessageToViewModelService.GetRefillResponseMessageData((ERxMessageTypes)(((??)msg.MsgType) ?? 10), msg.RawMessage);
						_refillResponseMessageData.MessageId = new Guid(msg.MsgId);
						if (string.IsNullOrWhiteSpace(_refillResponseMessageData.MessageReferenceNumber) && string.IsNullOrWhiteSpace(_refillResponseMessageData.RequestId))
						{
							MessageBoxServicePlatformExtensions.Show(_messageBoxService, "RxReferenceNumber or RelatesToMessageID not specified.", "Error Loading Refill/Renewal Response Message", (MessageBoxButton)0, (MessageBoxImage)16);
						}
						else
						{
							if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), _messageInterface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0 && string.IsNullOrEmpty(_refillResponseMessageData.SPI))
							{
								_refillResponseMessageData.SPI = messageData.SenderId;
							}
							await _erxWorkQueueService.LookupRefillOrder(_refillResponseMessageData);
						}
						message = _eRxMessageToViewModelService.GetViewModelsFromRefillResponseMessage(msg.MsgType.Value, _refillResponseMessageData, msg.RawMessage, out statusCode, out signatureFlag);
						if (statusCode == "R" && (int)(((??)msg.MsgType) ?? 10) == 10)
						{
							_newRxRequestMessageData = _eRxMessageToViewModelService.GetNewRxMessageDataFromRenewalResponse((ERxMessageTypes)(((??)msg.MsgType) ?? 10), msg.RawMessage);
							if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), _messageInterface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0 && string.IsNullOrEmpty(_newRxRequestMessageData.SPI))
							{
								_newRxRequestMessageData.SPI = messageData.SenderId;
							}
						}
						switch (statusCode)
						{
						case "A":
						case "C":
						case "R":
							await CheckForSignature(msg.MsgId, msg.MsgType.Value, signatureFlag, messageData);
							break;
						}
						if (statusCode == "D" || statusCode == "N")
						{
							_wizardViewModel.BackCommandText = "_Process Denial";
						}
						break;
					}
					case 7:
					{
						MessageTypeDisplay = "Resupply Request";
						_resupplyMessageData = _eRxMessageToViewModelService.GetResupplyMessageData((ERxMessageTypes)8, msg.RawMessage);
						if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), _messageInterface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0 && string.IsNullOrEmpty(_resupplyMessageData.PrescriberSPI))
						{
							_resupplyMessageData.PrescriberSPI = messageData.SenderId;
						}
						if (!string.IsNullOrWhiteSpace(_resupplyMessageData.DateValidated) && DateTime.TryParse(_resupplyMessageData.DateValidated, out var dateValidated))
						{
							bool flag = string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), _messageInterface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0;
							if (!flag)
							{
								flag = await _erxWorkQueueService.UseDateValidatedForRecertified(_mailboxId);
							}
							if (flag)
							{
								_resupplyMessageData.DateRecertified = dateValidated;
							}
						}
						if (!(await _erxWorkQueueService.UseDateValidatedForResupply(_mailboxId)))
						{
							_resupplyMessageData.DateValidated = "";
						}
						_resupplyMessageData.MessageId = new Guid(msg.MsgId);
						await _erxWorkQueueService.LookupResupplyOrder(_resupplyMessageData);
						message = _eRxMessageToViewModelService.GetViewModelsFromResupplyMessage(_resupplyMessageData, msg.RawMessage, out signatureFlag);
						if ((await _apiCallExecutor.ExecuteAsync(new GetSystemOptionByName((SystemOptionNames)330))).ValueAsBoolean())
						{
							await CheckForSignature(msg.MsgId, msg.MsgType.Value, signatureFlag, messageData);
						}
						break;
					}
					case 1:
						MessageTypeDisplay = "Census Request";
						message = _eRxMessageToViewModelService.GetViewModelsFromRxCensusRequestMessage(msg.RawMessage);
						break;
					case 12:
						MessageTypeDisplay = "RxFill Indicator Change Request";
						_rxFillIndicatorChangeMessageData = _eRxMessageToViewModelService.GetRxFillIndicatorChangeMessageData((ERxMessageTypes)13, msg.RawMessage);
						message = _eRxMessageToViewModelService.GetViewModelsFromRxFillIndicatorChangeMessage(msg.RawMessage);
						break;
					case 3:
						MessageTypeDisplay = "New Prescription Request";
						_hl7RxMessageData = _eRxMessageToViewModelService.GetHL7RequestData(msg.RawMessage);
						message = _eRxMessageToViewModelService.GetViewModelsFromHl7RxMessage(msg.RawMessage);
						ShowHL7Warning = true;
						break;
					case 13:
						MessageTypeDisplay = "Recertification Request";
						_recertificationMessageData = _eRxMessageToViewModelService.GetRecertificationMessageData((ERxMessageTypes)14, msg.RawMessage);
						_recertificationMessageData.MessageId = new Guid(msg.MsgId);
						_recertificationMessageData.Interface = _messageInterface;
						_recertificationMessageData.MailboxId = _mailboxId;
						if (string.IsNullOrWhiteSpace(_recertificationMessageData.FacID) && !string.IsNullOrWhiteSpace(_recertificationMessageData.PrescriberOrderNumber) && string.IsNullOrWhiteSpace(_recertificationMessageData.RelatedMsgID))
						{
							ERxMessageFacilityInfoModel val = _apiCallExecutor.ExecuteSync(new ERxLookupMessageFacility(_recertificationMessageData.MessageId, processFromEcm: false));
							_recertificationMessageData.FacID = val.FacilityId;
						}
						await _erxWorkQueueService.LookupRecertificationOrder(_recertificationMessageData);
						message = _eRxMessageToViewModelService.GetViewModelsFromRecertificationMessage(_recertificationMessageData, msg.RawMessage);
						break;
					}
				}
			}
			catch (Exception ex)
			{
				MessageBoxServicePlatformExtensions.Show(_messageBoxService, ex.Message, $"Error Parsing {MessageTypeDisplay} Message", (MessageBoxButton)0, (MessageBoxImage)16);
			}
		}
		MessageId = ((msg == null) ? null : msg.MsgId);
		MessageEntryDate = ((msg == null) ? ((DateTime?)null) : msg.EntryDt);
		CurrentMessage = msg;
		ErxMessageAsList = message;
		if (msg == null || msg.ClipLabel == null)
		{
			ClipLabel = string.Empty;
		}
		else
		{
			ClipLabel = msg.ClipLabel;
		}
		_wizardViewModel.ClipLabelVisible = true;
		InClipProcess = msg != null && msg.InClipProcess;
		if (message != null && message.Any())
		{
			ERxData = new ObservableCollection<ERxDataItemViewModel>(message);
			MessageId = MessageId;
		}
		if (ShowEPCSMessage)
		{
			if (EPCSSignatureValid)
			{
				EPCSMessageText = "This prescription meets the requirements of the Drug Enforcement Administration's electronic prescribing for controlled substances rules  (21 CFR Parts 1300, 1304, 1306 & 1311).";
			}
			else
			{
				EPCSMessageText = "This prescription does not meet the requirements of the Drug Enforcement Administration's electronic prescribing for controlled substances rules  (21 CFR Parts 1300, 1304, 1306 & 1311).  Follow up with the prescriber is required.";
				enableProcess = false;
			}
		}
		_wizardViewModel.BackEnabled = enableProcess;
		_wizardViewModel.NextEnabled = enableRefuse;
		_wizardViewModel.SendFocusMessage(enableProcess ? "BackCommand" : "CancelCommand", "", force: true);
		((BindableBase)this).RaisePropertiesChanged<bool, bool, bool, string>((Expression<Func<bool>>)(() => ShowEPCSMessage), (Expression<Func<bool>>)(() => ShowEPCSCertificate), (Expression<Func<bool>>)(() => EPCSSignatureValid), (Expression<Func<string>>)(() => EPCSMessageText));
		((BindableBase)this).RaisePropertyChanged<bool>((Expression<Func<bool>>)(() => ShowHL7Warning));
		((BindableBase)this).RaisePropertiesChanged<string, DateTime?, string, string>((Expression<Func<string>>)(() => MessageId), (Expression<Func<DateTime?>>)(() => MessageEntryDate), (Expression<Func<string>>)(() => MessageTypeDisplay), (Expression<Func<string>>)(() => ClipLabel));
	}

	private async Task CheckForSignature(string msgId, ERxMessageTypes msgType, bool signatureFlag, ERxMessageModel message = null)
	{
		//IL_001e: Unknown result type (might be due to invalid IL or missing references)
		//IL_001f: Unknown result type (might be due to invalid IL or missing references)
		if ((int)msgType != 5 && (int)msgType != 8 && (int)msgType != 7 && (int)msgType != 10)
		{
			return;
		}
		if (message == null)
		{
			message = await _apiCallExecutor.ExecuteAsync(new GetERxMessageById(new Guid(msgId)));
		}
		if (message == null)
		{
			return;
		}
		_messageInterface = message.Interface;
		_mailboxId = message.MailboxId;
		if (signatureFlag)
		{
			signatureFlag = false;
			if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)2), message.Interface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0)
			{
				signatureFlag = true;
			}
			else if (string.Compare(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)0), message.Interface.Trim(), StringComparison.InvariantCultureIgnoreCase) == 0 && await _apiCallExecutor.ExecuteAsync(new AllowSignatureIndicatorForVendor(message.MailboxId)))
			{
				signatureFlag = true;
			}
		}
		bool flag;
		bool ePCSSignatureValid;
		if (signatureFlag)
		{
			flag = true;
			ePCSSignatureValid = true;
		}
		else
		{
			flag = !string.IsNullOrWhiteSpace(message.Signature);
			ePCSSignatureValid = message.SignatureValid == true;
		}
		bool showEPCSCertificate = !string.IsNullOrWhiteSpace(message.Certificate);
		if (flag)
		{
			ShowEPCSCertificate = showEPCSCertificate;
			EPCSSignatureValid = ePCSSignatureValid;
		}
		ShowEPCSMessage = flag;
		_signaturePresent = flag;
	}

	private bool LookupPatientByFileID()
	{
		bool result = false;
		string patientFileId = _eRxMessageToViewModelService.GetPatientFileId((ERxMessageTypes)5, ProcessModel.Message.RawMessage);
		if (!string.IsNullOrWhiteSpace(patientFileId))
		{
			string[] array = patientFileId.Split(new char[1] { '|' });
			if (array.Length == 2)
			{
				PatientInfoModel val = _apiCallExecutor.ExecuteSync(new GetPatientLiteInfo(array[0], array[1]));
				if (val != null)
				{
					ProcessModel.PatientLastName = val.LastName;
					ProcessModel.PatientFirstName = val.FirstName;
					ProcessModel.PatientId = val.PatientId;
					ProcessModel.FacilityId = val.FacilityId;
					ProcessModel.PharmId = val.PharmId;
					ProcessModel.NsId = val.NursingStationId;
					result = true;
				}
			}
		}
		return result;
	}

	private bool LookupPatient()
	{
		//IL_0043: Unknown result type (might be due to invalid IL or missing references)
		bool result = false;
		ERxMessageFacilityInfoModel val = _apiCallExecutor.ExecuteSync(new ERxLookupMessageFacility(ProcessModel.MessageId, ProcessModel.ProcessFromEcm));
		ERxMessageDataModel messageData = _eRxMessageToViewModelService.GetMessageData((ERxMessageTypes)(((??)ProcessModel.Message.MsgType) ?? 5), ProcessModel.Message.RawMessage);
		if (!string.IsNullOrWhiteSpace(messageData.FirstName) && !string.IsNullOrWhiteSpace(messageData.LastName))
		{
			PatientLookupModel val2 = _apiCallExecutor.ExecuteSync(new LookupPatient((val != null) ? val.FacilityId : null, messageData.FirstName, messageData.LastName, messageData.SocialSecurityNumber, messageData.BirthDate, messageData.Gender));
			if (val2 != null)
			{
				ProcessModel.PatientLastName = val2.PatLName;
				ProcessModel.PatientFirstName = val2.PatFName;
				ProcessModel.PatientId = val2.PatId;
				ProcessModel.FacilityId = val2.FacId;
				result = true;
			}
		}
		return result;
	}

	private async Task<bool> LookupFacility(Guid erxMessageId, string facNpi, string facFileId, string facSpi)
	{
		bool result = false;
		LookupFacilityModel val = await _apiCallExecutor.ExecuteAsync(new LookupFacility(erxMessageId, facNpi, facFileId, facSpi));
		if (val != null)
		{
			ProcessModel.FacilityId = val.FacilityId;
			ProcessModel.FacName = val.FacilityName;
			result = true;
		}
		return result;
	}

	private async Task<ERxWorkQueueWizardViewModel.SubScreen?> BeginCensusRequest()
	{
		ERxWorkQueueWizardViewModel.SubScreen? result = null;
		ERxCensusMessageData censusRequestData = _eRxMessageToViewModelService.GetCensusRequestData((ERxMessageTypes)2, ProcessModel.Message.RawMessage);
		if (censusRequestData == null)
		{
			return result;
		}
		ProcessModel.CensusRequestData = censusRequestData;
		ProcessModel.CensusAdmitResult = (CensusAdmitResultEnum)0;
		ProcessModel.PaymentPlansCompleted = false;
		ProcessModel.AllergiesCompleted = false;
		ProcessModel.MedCondsCompleted = false;
		ProcessModel.CensusChangesMade = false;
		ProcessModel.PaymentPlansChanged = false;
		ProcessModel.AllergiesChanged = false;
		ProcessModel.MedCondsChanged = false;
		ProcessModel.NsIDRoomChange = false;
		if ((int)censusRequestData.RequestType == 1)
		{
			ERxMessageFacilityInfoModel val = _apiCallExecutor.ExecuteSync(new ERxLookupMessageFacility(ProcessModel.MessageId, ProcessModel.ProcessFromEcm));
			if (string.IsNullOrWhiteSpace(val.FacilityId))
			{
				result = ((!(await LookupFacility(ProcessModel.MessageId, censusRequestData.FacilityNPI, censusRequestData.FacilityFileID, censusRequestData.FacilitySPI))) ? new ERxWorkQueueWizardViewModel.SubScreen?(ERxWorkQueueWizardViewModel.SubScreen.ShowFacilitySelectionScreen) : new ERxWorkQueueWizardViewModel.SubScreen?(ERxWorkQueueWizardViewModel.SubScreen.ShowAdmitPatientScreen));
			}
			else
			{
				FacilityModel val2 = await _apiCallExecutor.ExecuteAsync(new GetFacilityById(val.FacilityId.Trim()));
				ProcessModel.FacilityId = val2.GetKeyValue();
				ProcessModel.FacName = val2.Name;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowAdmitPatientScreen;
			}
		}
		else if ((int)censusRequestData.RequestType == 3 || (int)censusRequestData.RequestType == 4 || (int)censusRequestData.RequestType == 6 || (int)censusRequestData.RequestType == 5 || (int)censusRequestData.RequestType == 7)
		{
			result = ((!LookupPatient()) ? new ERxWorkQueueWizardViewModel.SubScreen?(ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen) : (await _erxWorkQueueService.ProcessDischarge((ILtcViewModelBase)_wizardViewModel, ProcessModel)));
		}
		else if (LookupPatient())
		{
			ProcessModel.SkippedPatientSelection = true;
			FacilityInfoModel val3 = await _apiCallExecutor.ExecuteAsync(new GetFacilityLiteInfo(ProcessModel.FacilityId));
			ProcessModel.FacName = val3.Name;
			result = ERxWorkQueueWizardViewModel.SubScreen.ShowChangePatientScreen;
		}
		else
		{
			result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
		}
		return result;
	}

	private async Task<ERxWorkQueueWizardViewModel.SubScreen?> GetProcessScreen()
	{
		ERxWorkQueueWizardViewModel.SubScreen? result = null;
		switch (ProcessModel.Message.MsgType)
		{
		case (ERxMessageTypes)4L:
		{
			ProcessModel.SkippedPatientSelection = false;
			bool patientFound = LookupPatientByFileID();
			ERxWorkQueueProcessModel processModel = ProcessModel;
			processModel.ShowPatientOrdersScreen = (await _apiCallExecutor.ExecuteAsync(new GetSystemOptionByName((SystemOptionNames)192))).ValueAsBoolean();
			if (!patientFound)
			{
				patientFound = LookupPatient();
				ProcessModel.SkippedPatientSelection = patientFound;
			}
			if (patientFound)
			{
				result = ((ProcessModel.ShowPatientOrdersScreen != true) ? (await _erxWorkQueueService.DoProductSelection((ILtcViewModelBase)_wizardViewModel, ProcessModel)) : new ERxWorkQueueWizardViewModel.SubScreen?(ERxWorkQueueWizardViewModel.SubScreen.ShowPatientOrdersScreen));
			}
			else
			{
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			}
			break;
		}
		case (ERxMessageTypes)0L:
			if (ProcessModel.CancelMessageData.IsValid)
			{
				bool flag = true;
				if (!ProcessModel.CancelMessageData.FromRxs && (int)MessageBoxServicePlatformExtensions.Show(_messageBoxService, $"Are you sure that you wish to discontinue Ro# {ProcessModel.CancelMessageData.RoNo} ({ProcessModel.CancelMessageData.DrugName})?", "D/C Order", (MessageBoxButton)4, (MessageBoxImage)32) == 7)
				{
					flag = false;
				}
				if (flag)
				{
					result = await _erxWorkQueueService.ProcessCancelRequest((ILtcViewModelBase)_wizardViewModel, ProcessModel);
				}
			}
			else if (LookupPatient())
			{
				ProcessModel.SkippedPatientSelection = true;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowOrderSelectionScreen;
			}
			else
			{
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			}
			break;
		case (ERxMessageTypes)12L:
			result = await _erxWorkQueueService.ProcessRxFillIndicatorChangeMessage((ILtcViewModelBase)_wizardViewModel, ProcessModel);
			break;
		case (ERxMessageTypes)6L:
		case (ERxMessageTypes)9L:
			if (ProcessModel.RefillResponseData.IsValid)
			{
				if (ProcessModel.RefillResponseData.ResponseStatusCode == EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)4))
				{
					ProcessModel.SkippedPatientSelection = true;
					ProcessModel.LinkToAssocRo = true;
					ProcessModel.AssocRoNo = ProcessModel.RefillResponseData.RoNo.ToString();
					FacilityCutOffDateInfoModel val = await _apiCallExecutor.ExecuteAsync(new GetFacilityCutOffDateInfo(ProcessModel.RefillResponseData.FacilityId));
					YesterdayOrToday? val2 = ((val != null) ? val.DefaultReplace : ((YesterdayOrToday?)null));
					ProcessModel.AssocRoCutDate = (((int)val2.GetValueOrDefault() == 1) ? DateTime.Today.AddDays(-1.0) : DateTime.Today);
					ERxWorkQueueProcessModel processModel = ProcessModel;
					processModel.ShowPatientOrdersScreen = (await _apiCallExecutor.ExecuteAsync(new GetSystemOptionByName((SystemOptionNames)192))).ValueAsBoolean();
					if (LookupPatient())
					{
						if (ProcessModel.ShowPatientOrdersScreen == true)
						{
							result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientOrdersScreen;
							break;
						}
						ProcessModel.SkippedPatientSelection = true;
						result = await _erxWorkQueueService.DoProductSelection((ILtcViewModelBase)_wizardViewModel, ProcessModel);
					}
					else
					{
						result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
					}
				}
				else
				{
					ProcessModel.RxBatch = _wizardViewModel.ERxBatch;
					result = await _erxWorkQueueService.ProcessRefillResponse((ILtcViewModelBase)_wizardViewModel, ProcessModel);
					_wizardViewModel.ERxBatch = ProcessModel.RxBatch;
				}
			}
			else if (LookupPatient())
			{
				ProcessModel.SkippedPatientSelection = true;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowOrderSelectionScreen;
			}
			else
			{
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			}
			break;
		case (ERxMessageTypes)7L:
			if (ProcessModel.ResupplyMessageData.IsValid)
			{
				ProcessModel.FacilityId = ProcessModel.ResupplyMessageData.FacID;
				ProcessModel.PatientId = ProcessModel.ResupplyMessageData.PatID;
				ProcessModel.PatientFirstName = ProcessModel.ResupplyMessageData.PatFName;
				ProcessModel.PatientLastName = ProcessModel.ResupplyMessageData.PatLName;
				ProcessModel.FacName = ProcessModel.ResupplyMessageData.FacName;
				ProcessModel.MiddleInitial = ProcessModel.ResupplyMessageData.PatMI;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowOrderSelectionScreen;
			}
			else if (LookupPatient())
			{
				ProcessModel.SkippedPatientSelection = true;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowOrderSelectionScreen;
			}
			else
			{
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			}
			break;
		case (ERxMessageTypes)13L:
			if (ProcessModel.RecertificationRequestData.IsValid)
			{
				ProcessModel.FacilityId = ProcessModel.RecertificationRequestData.FacID;
				ProcessModel.PatientId = ProcessModel.RecertificationRequestData.PatID;
				ProcessModel.PatientFirstName = ProcessModel.RecertificationRequestData.PatFName;
				ProcessModel.PatientLastName = ProcessModel.RecertificationRequestData.PatLName;
				ProcessModel.FacName = ProcessModel.RecertificationRequestData.FacName;
				ProcessModel.MiddleInitial = ProcessModel.RecertificationRequestData.PatMI;
				ProcessModel.RoNo = ProcessModel.RecertificationRequestData.RoNo;
				result = await _erxWorkQueueService.ProcessRecertificationMessage((ILtcViewModelBase)_wizardViewModel, ProcessModel);
			}
			else if (LookupPatient())
			{
				ProcessModel.SkippedPatientSelection = true;
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowOrderSelectionScreen;
			}
			else
			{
				result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			}
			break;
		case (ERxMessageTypes)1L:
			result = await BeginCensusRequest();
			break;
		case (ERxMessageTypes)3L:
			result = ERxWorkQueueWizardViewModel.SubScreen.ShowPatientSelectionScreen;
			break;
		}
		return result;
	}

	public async Task<ERxWorkQueueWizardViewModel.SubScreen?> GetNextScreen()
	{
		if (CurrentMessage == null)
		{
			return null;
		}
		bool promptForReason = false;
		bool reasonColumnExists = await _apiCallExecutor.ExecuteAsync(new RefusalReasonColumnExists());
		if (reasonColumnExists)
		{
			promptForReason = (int)CurrentMessage.MsgType.GetValueOrDefault() != 1 || await _apiCallExecutor.ExecuteAsync(new GetERxIsFrameworkLinkCancelById(Guid.Parse(MessageId)));
		}
		ERxRefuseRequestResponse eRxRefuseRequestResponse = null;
		if (promptForReason)
		{
			eRxRefuseRequestResponse = await _showWindowService.ShowMdiDialog<ERxRefuseRequestView, ERxRefuseRequestViewModel, ERxRefuseRequestResponse>((ILtcViewModelBase)this, (Action<ERxRefuseRequestViewModel>)null, (Point?)null);
			if (eRxRefuseRequestResponse == null || !eRxRefuseRequestResponse.Result)
			{
				return null;
			}
		}
		else if ((int)MessageBoxServicePlatformExtensions.Show(_messageBoxService, "Refusing this request will delete it from the queue, and it will no longer be available for processing. Are you sure that you want to continue?", "Confirmation", (MessageBoxButton)4, (MessageBoxImage)32) == 7)
		{
			return null;
		}
		ERxMessageTypes? msgType = CurrentMessage.MsgType;
		if (msgType.HasValue)
		{
			ERxMessageTypes valueOrDefault = msgType.GetValueOrDefault();
			if ((int)valueOrDefault != 1)
			{
				switch (valueOrDefault - 5)
				{
				case 2:
				case 5:
					if (!string.IsNullOrWhiteSpace(_refillResponseMessageData.RequestId))
					{
						await _apiCallExecutor.ExecuteAsync(new RemoveRefillRequest(new RemoveRefillRequestModel
						{
							RequestId = _refillResponseMessageData.RequestId
						}));
					}
					break;
				case 0:
				{
					await _apiCallExecutor.ExecuteAsync(new RemoveFromPendingDrugOrders(Guid.Parse(MessageId)));
					ERxArgumentsModel request2 = new ERxArgumentsModel
					{
						ID = Guid.Parse(MessageId),
						RefusalReason = eRxRefuseRequestResponse?.RefusalReason,
						ERxRxFillIndicator = _newRxRequestMessageData.RxFillIndicator
					};
					await _apiCallExecutor.ExecuteAsync(new SendSureScriptNotFilledMessage(request2));
					await _apiCallExecutor.ExecuteAsync(new DeleteEDPPendingOrder(Guid.Parse(MessageId)));
					break;
				}
				case 3:
					if (string.IsNullOrWhiteSpace(_mailboxId) || (!_mailboxId.Equals(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)3), StringComparison.InvariantCultureIgnoreCase) && !_mailboxId.Equals(EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)4), StringComparison.InvariantCultureIgnoreCase)))
					{
						ERxArgumentsModel request = new ERxArgumentsModel
						{
							ID = Guid.Parse(MessageId),
							RefusalReason = eRxRefuseRequestResponse?.RefusalReason,
							ERxRxFillIndicator = _resupplyMessageData.RxFillIndicator
						};
						if (!string.Equals(_messageInterface, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxInterfaceType)0), StringComparison.OrdinalIgnoreCase))
						{
							await _apiCallExecutor.ExecuteAsync(new SendSureScriptNotFilledMessage(request));
						}
						else
						{
							await _apiCallExecutor.ExecuteAsync(new SendNotFilledMessage(request));
						}
					}
					await _apiCallExecutor.ExecuteAsync(new DeleteEDPPendingOrder(Guid.Parse(MessageId)));
					break;
				}
			}
			else
			{
				ERxWorkQueueProcessModel processModel = new ERxWorkQueueProcessModel
				{
					MessageId = Guid.Parse(CurrentMessage.MsgId),
					Message = CurrentMessage,
					ErxMessageAsList = ErxMessageAsList,
					MailboxId = _mailboxId,
					MessageInterface = _messageInterface,
					SignaturePresent = _signaturePresent,
					SignatureValid = EPCSSignatureValid,
					PharmId = _msgPharmId,
					CancelMessageData = _cancelRequestMessageData,
					FacilityId = _cancelRequestMessageData.FacilityId,
					PatientId = _cancelRequestMessageData.PatientId,
					RoNo = _cancelRequestMessageData.RoNo
				};
				string refusalReason = await _erxWorkQueueService.RefuseCancelRequest((ILtcViewModelBase)_wizardViewModel, processModel);
				if (reasonColumnExists && !promptForReason)
				{
					eRxRefuseRequestResponse = new ERxRefuseRequestResponse
					{
						RefusalReason = refusalReason
					};
				}
				await _apiCallExecutor.ExecuteAsync(new DeleteEDPPendingOrder(Guid.Parse(MessageId)));
			}
		}
		await _apiCallExecutor.ExecuteAsync(new CreateERxRefusal(Guid.Parse(MessageId), _appUserInfo.UserName, eRxRefuseRequestResponse?.RefusalReason));
		return ERxWorkQueueWizardViewModel.SubScreen.WizardDone;
	}

	public async Task<ERxWorkQueueWizardViewModel.SubScreen?> GetPreviousScreen()
	{
		if (CurrentMessage == null)
		{
			return null;
		}
		ERxWorkQueueProcessModel eRxWorkQueueProcessModel = new ERxWorkQueueProcessModel
		{
			MessageId = Guid.Parse(CurrentMessage.MsgId),
			Message = CurrentMessage,
			ErxMessageAsList = ErxMessageAsList,
			MailboxId = _mailboxId,
			MessageInterface = _messageInterface,
			SignatureValid = EPCSSignatureValid,
			SignaturePresent = _signaturePresent,
			PharmId = _msgPharmId,
			ProcessFromEcm = ProcessFromECM
		};
		switch (CurrentMessage.MsgType)
		{
		case (ERxMessageTypes)4L:
			eRxWorkQueueProcessModel.NewRxRequestData = _newRxRequestMessageData;
			break;
		case (ERxMessageTypes)0L:
			eRxWorkQueueProcessModel.CancelMessageData = _cancelRequestMessageData;
			eRxWorkQueueProcessModel.FacilityId = _cancelRequestMessageData.FacilityId;
			eRxWorkQueueProcessModel.PatientId = _cancelRequestMessageData.PatientId;
			eRxWorkQueueProcessModel.RoNo = _cancelRequestMessageData.RoNo;
			break;
		case (ERxMessageTypes)6L:
		case (ERxMessageTypes)9L:
			eRxWorkQueueProcessModel.RefillResponseData = _refillResponseMessageData;
			eRxWorkQueueProcessModel.NewRxRequestData = null;
			if (_refillResponseMessageData.ResponseStatusCode == EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)4))
			{
				eRxWorkQueueProcessModel.NewRxRequestData = _newRxRequestMessageData;
			}
			break;
		case (ERxMessageTypes)7L:
			eRxWorkQueueProcessModel.ResupplyMessageData = _resupplyMessageData;
			break;
		case (ERxMessageTypes)12L:
			eRxWorkQueueProcessModel.RxFillIndicatorChangeRequestData = _rxFillIndicatorChangeMessageData;
			break;
		case (ERxMessageTypes)13L:
			eRxWorkQueueProcessModel.RecertificationRequestData = _recertificationMessageData;
			break;
		case (ERxMessageTypes)3L:
			eRxWorkQueueProcessModel.HL7RxMessageData = _hl7RxMessageData;
			break;
		}
		_wizardViewModel.SetProcessModel(eRxWorkQueueProcessModel);
		return await GetProcessScreen();
	}

	public async Task Load()
	{
		ILtcViewModelBase ltcViewModelBase = (ILtcViewModelBase)_wizardViewModel;
		HelpFileContext helpFileContext = (HelpFileContext = HelpFileContext.Erx_WorkQueue);
		ltcViewModelBase.HelpFileContext = helpFileContext;
		if (_dataLoaded)
		{
			return;
		}
		InClipProcess = false;
		ClipLabel = "";
		MessageId = "";
		HL7WarningText = "This message was communicated using the HL7 protocol and may\r\nnot be considered sufficient for Medicare Part D prescriptions.";
		_eRxWorkQueueDisconnectMinutes = (await _apiCallExecutor.ExecuteAsync(new GetSystemOptionByName((SystemOptionNames)473))).ValueAsInt(false);
		_wizardViewModel.NextEnabled = false;
		_wizardViewModel.BackEnabled = false;
		if (string.IsNullOrWhiteSpace(LoggedInPharmacistNpi))
		{
			PharmacistModel val = await _apiCallExecutor.ExecuteAsync(new GetLoggedInPharmacist());
			LoggedInPharmacistNpi = ((val != null) ? val.Id.Current : null);
		}
		if (ProcessFromECM)
		{
			await LoadMessage(ErxMessage);
		}
		else
		{
			await SetFolder();
			if (CurrentFolder != null && CurrentFolder.Id.ToString() == "NOFOLDER")
			{
				_wizardViewModel.CloseViewNoFolder = true;
				return;
			}
			await DequeueNextMessage();
			_pollingTimer = new DispatcherTimer();
			_pollingTimer.Interval = TimeSpan.FromSeconds(15.0);
			_pollingTimer.Tick += PollingTimer_Tick;
			_pollingTimer.IsEnabled = true;
			MessengerExtensions.Send<UpdateQueueStatusMessage>(_messenger, new UpdateQueueStatusMessage(OriginType.ERxQueue, string.Empty));
		}
		_dataLoaded = true;
	}

	public ERxWorkQueueWizardViewModel.SubScreen GetScreen()
	{
		return ERxWorkQueueWizardViewModel.SubScreen.ShowWorkQueueScreen;
	}

	public string GetDialogTitle()
	{
		return "";
	}

	public async Task ShowView()
	{
		ShowViewFlag = true;
		_wizardViewModel.BackCommandText = "_Process Request";
		_wizardViewModel.NextCommandText = "_Refuse Request";
		_wizardViewModel.CancelCommandText = "_Quit";
		await Load();
	}

	public void HideView()
	{
		ShowViewFlag = false;
	}

	public void SetMessage(ERxWorkQueueProcessModel processModel)
	{
		ProcessModel = processModel;
	}

	public void HandleMessageProcessed()
	{
	}

	public void SetWizardReference(IERxWorkQueueWizardViewModel wizardViewModel)
	{
		_wizardViewModel = wizardViewModel;
	}

	public void ExecuteCloseActions()
	{
	}

	public override void OnClosed()
	{
		base.OnClosed();
		if (_pollingTimer != null)
		{
			_pollingTimer.Stop();
		}
	}
}
