using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using AutoMapper;
using DevExpress.Mvvm;
using DevExpress.Mvvm.POCO;
using SoftWriters.FrameworkLtc.ApiCalls;
using SoftWriters.FrameworkLtc.Common.Infrastructure;
using SoftWriters.FrameworkLtc.Common.Services;
using SoftWriters.FrameworkLtc.Common.Services.Database;
using SoftWriters.FrameworkLtc.Infrastructure;
using SoftWriters.FrameworkLtc.Infrastructure.AppState;
using SoftWriters.FrameworkLtc.Infrastructure.Commands;
using SoftWriters.FrameworkLtc.Interop;
using SoftWriters.FrameworkLtc.Messages.Views;
using SoftWriters.FrameworkLtc.Models.ERx;
using SoftWriters.FrameworkLtc.Models.Shared;
using SoftWriters.FrameworkLtc.Services;
using SoftWriters.FrameworkLtc.Services.Crud;
using SoftWriters.FrameworkLtc.Services.ERx;
using SoftWriters.FrameworkLtc.Services.Legacy;
using SoftWriters.FrameworkLtc.Services.Reports;
using SoftWriters.FrameworkLtc.Services.Sound;
using SoftWriters.FrameworkLtc.Services.UISettings;
using SoftWriters.FrameworkLtc.ViewModels.Physicians;
using SoftWriters.FrameworkLtc.ViewModels.Printing;
using Softwriters.FrameworkECM.ClientIntegration;

namespace SoftWriters.FrameworkLtc.ViewModels.Prescriptions.ERxWorkQueue;

public class ERxWorkQueueWizardViewModel : LtcViewModelBase<ERxWorkQueueWizardViewModel>, IERxWorkQueueWizardViewModel, IValidateCloseViewModel
{
	public enum LastScreenAction
	{
		Quit,
		RefuseOrNext,
		ProcessOrBack
	}

	public enum SubScreen
	{
		ShowWorkQueueScreen,
		ShowPatientOrdersScreen,
		ShowPatientSelectionScreen,
		ShowFacilitySelectionScreen,
		ShowAdmitPatientScreen,
		ShowChangePatientScreen,
		ShowProductSelectionScreen,
		ShowProductSelectionScreenHL7,
		ShowGenericSubstitution,
		ShowGenericSubstitutionHL7,
		ShowBiosimilarSubstitution,
		ShowHouseStock,
		ShowDirections,
		ShowOrderSelectionScreen,
		WizardDone,
		WizardCancel
	}

	public const string ERxTriageFunctionalityEnabledButNoAccess = "The E-Rx triage functionality is enabled, but you have not been given access to any folders.";

	public const string DialogTitleBase = "E-Rx Work Queue";

	public const string RenewScreenLoadedError = "You must complete or cancel the current renewal.";

	public const string ErrorDialogTitle = "Error";

	private const string QuitInClip = "All items in this clip have not been processed. If you quit, the remaining items will be placed back into the queue. Are you sure that you wish to quit?";

	private const string QuitInClipTitle = "Abort Processing";

	private readonly IApiCallExecutor _apiCallExecutor;

	private readonly IMessageBoxService _messageBoxService;

	private readonly IERxMessageToViewModelService _eRxMessageToViewModelService;

	private readonly IERxMessageService _erxMessageService;

	private readonly IXmlPrintService _xmlPrintService;

	private readonly IExceptionLogger _exceptionLogger;

	private readonly IMessenger _messenger;

	private readonly IShowWindowService _showWindowService;

	private readonly IAppUserInfo _appUserInfo;

	private readonly ILtcOptions _ltcOptions;

	private readonly ICurrentPrinterViewModel _currentPrinter;

	private readonly IERxWorkQueueService _erxWorkQueueService;

	private readonly IVb6FormService _vb6FormService;

	private readonly IMappingEngine _mappingEngine;

	private readonly IPhysicianSelectorViewModel _physiciansSelViewModel;

	private readonly IDatabaseConnectionStringService _connectionStringService;

	private readonly ISystemOptionService _systemOptionService;

	private readonly IWindowInteropUtility _windowInteropUtility;

	private readonly IFwDateTime _fwDateTime;

	private readonly IChangeFacilityService _changeFacilityService;

	private readonly IGridColumnViewPersister _gridColumnViewPersister;

	private bool _isInitializing;

	private LastScreenAction lastActionMainScreen;

	private LastScreenAction lastActionProdSelScreen = LastScreenAction.ProcessOrBack;

	private ERxWorkQueueProcessModel ProcessModel { get; set; }

	private bool ProcessFromEcm { get; set; }

	public virtual IAsyncCommand NextCommand { get; set; }

	public virtual IAsyncCommand BackCommand { get; set; }

	public virtual IAsyncCommand CancelCommand { get; set; }

	public virtual ICommand EscapeCommand { get; set; }

	public ICommand OnViewLoadedCommand { get; set; }

	public virtual string WizardTitle { get; set; }

	public virtual bool BackEnabled { get; set; }

	public virtual bool NextEnabled { get; set; }

	public virtual string BackCommandText { get; set; }

	public virtual string NextCommandText { get; set; }

	public virtual string CancelCommandText { get; set; }

	public virtual int MinWidth { get; set; }

	public virtual int MinHeight { get; set; }

	public virtual bool ClipLabelVisible { get; set; }

	public virtual bool IsEnabled { get; set; }

	public virtual bool CloseViewNoFolder { get; set; }

	public ERxWorkQueueViewModel WorkQueueViewModel { get; set; }

	public ERxWorkQueuePatientOrdersViewModel PatientOrdersViewModel { get; set; }

	public ERxWorkQueuePatientSelectionViewModel PatientSelectionViewModel { get; set; }

	public ERxWorkQueueFacilitySelectionViewModel FacilitySelectionViewModel { get; set; }

	public ERxWorkQueueAdmitPatientViewModel AdmitPatientViewModel { get; set; }

	public ERxWorkQueueProductSelectionViewModel ProductSelectionViewModel { get; set; }

	public ERxWorkQueueProductSelectionHL7ViewModel ProductSelectionViewModelHL7 { get; set; }

	public ERxWorkQueueOrderSelectionViewModel OrderSelectionViewModel { get; set; }

	public ERxWorkQueueChangePatientViewModel ChangePatientViewModel { get; set; }

	public ERxWorkQueueGenericSubstitutionViewModel GenericSubstitutionViewModel { get; set; }

	public ERxWorkQueueGenericSubstitutionHL7ViewModel GenericSubstitutionHL7ViewModel { get; set; }

	public ERxWorkQueueHouseStockViewModel HouseStockViewModel { get; set; }

	public ERxWorkQueueDirectionsViewModel DirectionsViewModel { get; set; }

	public ERxWorkQueueBiosimilarSubstitutionViewModel BiosimilarSubstitutionViewModel { get; set; }

	private IERxWorkQueuePageViewModel CurrentScreen { get; set; }

	private List<IERxWorkQueuePageViewModel> AllScreens { get; set; }

	public string ERxBatch
	{
		get
		{
			dynamic val = _vb6FormService.FindFormByName("frmMainMenu");
			if (val == null)
			{
				throw new Exception("frmMainMenu was not found");
			}
			return val.ERxBatch;
		}
		set
		{
			dynamic val = _vb6FormService.FindFormByName("frmMainMenu");
			if (val == null)
			{
				throw new Exception("frmMainMenu was not found");
			}
			val.ERxBatch = value ?? "";
		}
	}

	public ERxWorkQueueWizardViewModel(IApiCallExecutor apiCallExecutor, IMessageBoxService messageBoxService, IERxMessageToViewModelService eRxMessageToViewModelService, IERxMessageService erxMessageService, IXmlPrintService xmlPrintService, IExceptionLogger exceptionLogger, IMessenger messenger, IShowWindowService showWindowService, IAppUserInfo appUserInfo, ILtcOptions ltcOptions, ICurrentPrinterViewModel currentPrinter, IPatientDataSavingService dataSavingService, IERxWorkQueueService erxWorkQueueService, IVb6FormService vb6formService, IMappingEngine mappingEngine, ISoundService soundService, ITranslateSigService translateSigService, IPhysicianSelectorViewModel physiciansSelViewModel, IFwDispatcher dispatcher, IDatabaseConnectionStringService connectionStringService, ISystemOptionService systemOptionService, IWindowInteropUtility windowInteropUtility, IFwDateTime fwDateTime, IChangeFacilityService changeFacilityService, IGridColumnViewPersister gridColumnViewPersister)
	{
		//IL_11a4: Unknown result type (might be due to invalid IL or missing references)
		//IL_11ae: Expected Obj, but got Unknown
		//IL_11bb: Unknown result type (might be due to invalid IL or missing references)
		//IL_11c5: Expected Obj, but got Unknown
		ERxWorkQueueWizardViewModel eRxWorkQueueWizardViewModel = this;
		_apiCallExecutor = apiCallExecutor;
		_messageBoxService = messageBoxService;
		_eRxMessageToViewModelService = eRxMessageToViewModelService;
		_erxMessageService = erxMessageService;
		_xmlPrintService = xmlPrintService;
		_exceptionLogger = exceptionLogger;
		_messenger = messenger;
		_showWindowService = showWindowService;
		_appUserInfo = appUserInfo;
		_ltcOptions = ltcOptions;
		_currentPrinter = currentPrinter;
		_erxWorkQueueService = erxWorkQueueService;
		_vb6FormService = vb6formService;
		_mappingEngine = mappingEngine;
		_physiciansSelViewModel = physiciansSelViewModel;
		_connectionStringService = connectionStringService;
		_systemOptionService = systemOptionService;
		_windowInteropUtility = windowInteropUtility;
		_fwDateTime = fwDateTime;
		_changeFacilityService = changeFacilityService;
		_gridColumnViewPersister = gridColumnViewPersister;
		IsEnabled = true;
		WorkQueueViewModel = ViewModelSource.Create<ERxWorkQueueViewModel>((Expression<Func<ERxWorkQueueViewModel>>)(() => new ERxWorkQueueViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, _eRxMessageToViewModelService, _erxMessageService, _xmlPrintService, _exceptionLogger, _messenger, _showWindowService, _appUserInfo, _ltcOptions, _currentPrinter, dispatcher, _windowInteropUtility, _fwDateTime, _changeFacilityService)));
		PatientSelectionViewModel = ViewModelSource.Create<ERxWorkQueuePatientSelectionViewModel>((Expression<Func<ERxWorkQueuePatientSelectionViewModel>>)(() => new ERxWorkQueuePatientSelectionViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, _eRxMessageToViewModelService, messenger)));
		PatientOrdersViewModel = ViewModelSource.Create<ERxWorkQueuePatientOrdersViewModel>((Expression<Func<ERxWorkQueuePatientOrdersViewModel>>)(() => new ERxWorkQueuePatientOrdersViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, messenger, _showWindowService, _gridColumnViewPersister)));
		FacilitySelectionViewModel = ViewModelSource.Create<ERxWorkQueueFacilitySelectionViewModel>((Expression<Func<ERxWorkQueueFacilitySelectionViewModel>>)(() => new ERxWorkQueueFacilitySelectionViewModel(_apiCallExecutor, _messageBoxService, _appUserInfo, messenger)));
		AdmitPatientViewModel = ViewModelSource.Create<ERxWorkQueueAdmitPatientViewModel>((Expression<Func<ERxWorkQueueAdmitPatientViewModel>>)(() => new ERxWorkQueueAdmitPatientViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, messenger, dataSavingService, _showWindowService, _physiciansSelViewModel)));
		ProductSelectionViewModel = ViewModelSource.Create<ERxWorkQueueProductSelectionViewModel>((Expression<Func<ERxWorkQueueProductSelectionViewModel>>)(() => new ERxWorkQueueProductSelectionViewModel(_apiCallExecutor, _messageBoxService, _eRxMessageToViewModelService, soundService, _messenger, dispatcher, showWindowService, _systemOptionService)));
		OrderSelectionViewModel = ViewModelSource.Create<ERxWorkQueueOrderSelectionViewModel>((Expression<Func<ERxWorkQueueOrderSelectionViewModel>>)(() => new ERxWorkQueueOrderSelectionViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, messenger, _showWindowService)));
		ChangePatientViewModel = ViewModelSource.Create<ERxWorkQueueChangePatientViewModel>((Expression<Func<ERxWorkQueueChangePatientViewModel>>)(() => new ERxWorkQueueChangePatientViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, messenger, _mappingEngine)));
		ProductSelectionViewModelHL7 = ViewModelSource.Create<ERxWorkQueueProductSelectionHL7ViewModel>((Expression<Func<ERxWorkQueueProductSelectionHL7ViewModel>>)(() => new ERxWorkQueueProductSelectionHL7ViewModel(_apiCallExecutor, _messageBoxService, erxWorkQueueService, _showWindowService, soundService, messenger, dispatcher, _systemOptionService)));
		GenericSubstitutionViewModel = ViewModelSource.Create<ERxWorkQueueGenericSubstitutionViewModel>((Expression<Func<ERxWorkQueueGenericSubstitutionViewModel>>)(() => new ERxWorkQueueGenericSubstitutionViewModel(_apiCallExecutor, _messageBoxService, messenger, _showWindowService)));
		BiosimilarSubstitutionViewModel = ViewModelSource.Create<ERxWorkQueueBiosimilarSubstitutionViewModel>((Expression<Func<ERxWorkQueueBiosimilarSubstitutionViewModel>>)(() => new ERxWorkQueueBiosimilarSubstitutionViewModel(_apiCallExecutor, _messageBoxService, messenger, _showWindowService)));
		GenericSubstitutionHL7ViewModel = ViewModelSource.Create<ERxWorkQueueGenericSubstitutionHL7ViewModel>((Expression<Func<ERxWorkQueueGenericSubstitutionHL7ViewModel>>)(() => new ERxWorkQueueGenericSubstitutionHL7ViewModel(_apiCallExecutor, erxWorkQueueService, _messageBoxService, messenger, _showWindowService)));
		HouseStockViewModel = ViewModelSource.Create<ERxWorkQueueHouseStockViewModel>((Expression<Func<ERxWorkQueueHouseStockViewModel>>)(() => new ERxWorkQueueHouseStockViewModel(erxWorkQueueService, _apiCallExecutor, _showWindowService, messenger)));
		DirectionsViewModel = ViewModelSource.Create<ERxWorkQueueDirectionsViewModel>((Expression<Func<ERxWorkQueueDirectionsViewModel>>)(() => new ERxWorkQueueDirectionsViewModel(erxWorkQueueService, _apiCallExecutor, _messageBoxService, _showWindowService, messenger, soundService, translateSigService)));
		ChildViewModels.Add(WorkQueueViewModel);
		ChildViewModels.Add(PatientSelectionViewModel);
		ChildViewModels.Add(PatientOrdersViewModel);
		ChildViewModels.Add(FacilitySelectionViewModel);
		ChildViewModels.Add(AdmitPatientViewModel);
		ChildViewModels.Add(ProductSelectionViewModel);
		ChildViewModels.Add(ProductSelectionViewModelHL7);
		ChildViewModels.Add(OrderSelectionViewModel);
		ChildViewModels.Add(ChangePatientViewModel);
		ChildViewModels.Add(GenericSubstitutionViewModel);
		ChildViewModels.Add(GenericSubstitutionHL7ViewModel);
		ChildViewModels.Add(BiosimilarSubstitutionViewModel);
		ChildViewModels.Add(HouseStockViewModel);
		ChildViewModels.Add(DirectionsViewModel);
		AllScreens = new List<IERxWorkQueuePageViewModel>();
		AllScreens.Add(WorkQueueViewModel);
		AllScreens.Add(PatientSelectionViewModel);
		AllScreens.Add(PatientOrdersViewModel);
		AllScreens.Add(FacilitySelectionViewModel);
		AllScreens.Add(AdmitPatientViewModel);
		AllScreens.Add(ProductSelectionViewModel);
		AllScreens.Add(ProductSelectionViewModelHL7);
		AllScreens.Add(OrderSelectionViewModel);
		AllScreens.Add(ChangePatientViewModel);
		AllScreens.Add(GenericSubstitutionViewModel);
		AllScreens.Add(GenericSubstitutionHL7ViewModel);
		AllScreens.Add(BiosimilarSubstitutionViewModel);
		AllScreens.Add(HouseStockViewModel);
		AllScreens.Add(DirectionsViewModel);
		MinWidth = 600;
		MinHeight = 550;
		NextCommand = new AsyncDelegateCommand(NextOrRefuse);
		BackCommand = new AsyncDelegateCommand(BackOrProcess);
		CancelCommand = new AsyncDelegateCommand(Cancel);
		EscapeCommand = (ICommand)new DelegateCommand((Action)Escape);
		OnViewLoadedCommand = (ICommand)new DelegateCommand((Action)OnViewLoaded);
		_erxWorkQueueService.ERxResponseHandled += OnERxResponseHandled;
	}

	private void OnERxResponseHandled(object sender, EventArgs e)
	{
		((DispatcherObject)Application.Current).Dispatcher.Invoke<Task>((Func<Task>)(() => MarkDoneAndLoadNextMessage()));
	}

	public void SetFromECMData(bool fromECM, ERxWorkQueueMessageModel msg)
	{
		ProcessFromEcm = true;
		WorkQueueViewModel.SetFromECMData(fromECM, msg);
	}

	public void SetProcessModel(ERxWorkQueueProcessModel processModel)
	{
		ProcessModel = processModel;
		AllScreens.ForEach((IERxWorkQueuePageViewModel p) =>
		{
			p.SetMessage(ProcessModel);
		});
	}

	public void SetMessageProcessedInPages()
	{
		AllScreens.ForEach((IERxWorkQueuePageViewModel p) =>
		{
			p.HandleMessageProcessed();
		});
	}

	public override async Task Initialize()
	{
		_ = 1;
		try
		{
			_isInitializing = true;
			WizardTitle = "E-Rx Work Queue";
			await base.Initialize();
			AllScreens.ForEach((IERxWorkQueuePageViewModel p) =>
			{
				p.SetWizardReference(this);
			});
			await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
		}
		finally
		{
			_isInitializing = false;
		}
	}

	private void OnViewLoaded()
	{
		if (CloseViewNoFolder)
		{
			CloseView();
		}
	}

	public async Task<bool> SafeToClose()
	{
		await _erxWorkQueueService.HandleRxEntryCloseAsDoneIfSaved();
		return true;
	}

	public string ERxBatchIfInList(List<GenericComboBoxModel> batchList)
	{
		string result = string.Empty;
		if (batchList.Any((GenericComboBoxModel p) => string.Equals(p.Id.ToString(), ERxBatch, StringComparison.OrdinalIgnoreCase)))
		{
			result = ERxBatch;
		}
		return result;
	}

	public async Task MarkDoneAndLoadNextMessage()
	{
		WorkQueueViewModel.ShowEPCSMessage = false;
		await _erxMessageService.DequeueCompleted();
		SetMessageProcessedInPages();
		await WorkQueueViewModel.CompleteCurrentAndDequeueNextMessage();
		await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
	}

	private bool RenewScreenLoaded()
	{
		//IL_0020: Unknown result type (might be due to invalid IL or missing references)
		if (_erxWorkQueueService.RenewScreenLoaded)
		{
			MessageBoxServicePlatformExtensions.Show(_messageBoxService, "You must complete or cancel the current renewal.", "Error", (MessageBoxButton)0, (MessageBoxImage)16);
			return true;
		}
		return false;
	}

	private void SetIsEnabled(bool isEnabled)
	{
		MessengerExtensions.Send<ShowWaitingCursorMessage>(_messenger, new ShowWaitingCursorMessage(this, !isEnabled));
		IsEnabled = isEnabled;
	}

	private async Task SetCurrentScreen(SubScreen screen)
	{
		CurrentScreen = AllScreens.FirstOrDefault((IERxWorkQueuePageViewModel p) => p.GetScreen() == screen);
		string text = ((CurrentScreen != null) ? CurrentScreen.GetDialogTitle() : "");
		WizardTitle = "E-Rx Work Queue" + (string.IsNullOrWhiteSpace(text) ? "" : (" - " + text));
		if (CurrentScreen != null && CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
		{
			ClipLabelVisible = true;
		}
		else
		{
			ClipLabelVisible = false;
		}
		await ShowOnlyCurrentScreen();
		SetFocusToCorrectButton();
	}

	private void SetFocusToCorrectButton()
	{
		if (CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
		{
			switch (lastActionMainScreen)
			{
			case LastScreenAction.Quit:
				SendFocusMessage("CancelCommand");
				break;
			case LastScreenAction.RefuseOrNext:
				SendFocusMessage("NextCommand", "CancelCommand");
				break;
			case LastScreenAction.ProcessOrBack:
				SendFocusMessage("BackCommand", "CancelCommand");
				break;
			}
		}
		else if (CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreen || CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreenHL7)
		{
			switch (lastActionProdSelScreen)
			{
			case LastScreenAction.Quit:
				SendFocusMessage("CancelCommand");
				break;
			case LastScreenAction.RefuseOrNext:
				SendFocusMessage("NextCommand", "CancelCommand");
				break;
			case LastScreenAction.ProcessOrBack:
				SendFocusMessage("BackCommand", "CancelCommand");
				break;
			}
		}
		else if (CurrentScreen.GetScreen() == SubScreen.ShowGenericSubstitution || CurrentScreen.GetScreen() == SubScreen.ShowBiosimilarSubstitution || CurrentScreen.GetScreen() == SubScreen.ShowGenericSubstitutionHL7)
		{
			SendFocusMessage("NextCommand", "CancelCommand");
		}
		else if (CurrentScreen.GetScreen() == SubScreen.ShowPatientOrdersScreen)
		{
			SendFocusMessage("BackCommand", "CancelCommand");
		}
	}

	private async Task ShowOnlyCurrentScreen()
	{
		foreach (IERxWorkQueuePageViewModel allScreen in AllScreens)
		{
			if (allScreen == CurrentScreen)
			{
				try
				{
					SetIsEnabled(isEnabled: false);
					await allScreen.ShowView();
				}
				finally
				{
					SetIsEnabled(isEnabled: true);
				}
			}
			else
			{
				allScreen.HideView();
			}
		}
	}

	public async Task NextOrRefuse()
	{
		if (RenewScreenLoaded())
		{
			return;
		}
		if (CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
		{
			lastActionMainScreen = LastScreenAction.RefuseOrNext;
		}
		else if (CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreen || CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreenHL7)
		{
			lastActionProdSelScreen = LastScreenAction.RefuseOrNext;
		}
		SubScreen? subScreen = SubScreen.ShowWorkQueueScreen;
		if (CurrentScreen != null)
		{
			try
			{
				SetIsEnabled(isEnabled: false);
				subScreen = await CurrentScreen.GetNextScreen();
			}
			finally
			{
				SetIsEnabled(isEnabled: true);
			}
		}
		if (subScreen == SubScreen.WizardCancel)
		{
			await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
		}
		else if (subScreen == SubScreen.WizardDone)
		{
			if (ProcessFromEcm)
			{
				VB6DocumentAssociation val = new VB6DocumentAssociation();
				if (CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
				{
					val.QueueMessageProcessed(_connectionStringService.Vb6ConnectionString, WorkQueueViewModel.ErxMessage.EcmDocumentId, (ProcessingDisposition)1);
				}
				else
				{
					val.QueueMessageProcessed(_connectionStringService.Vb6ConnectionString, WorkQueueViewModel.ErxMessage.EcmDocumentId, (ProcessingDisposition)0);
				}
				CloseView();
			}
			else
			{
				await MarkDoneAndLoadNextMessage();
			}
		}
		else if (subScreen.HasValue)
		{
			await SetCurrentScreen(subScreen.Value);
		}
	}

	public async Task BackOrProcess()
	{
		if (RenewScreenLoaded())
		{
			return;
		}
		if (CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
		{
			lastActionMainScreen = LastScreenAction.ProcessOrBack;
		}
		else if (CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreen || CurrentScreen.GetScreen() == SubScreen.ShowProductSelectionScreenHL7)
		{
			lastActionProdSelScreen = LastScreenAction.ProcessOrBack;
		}
		SubScreen? subScreen = SubScreen.ShowWorkQueueScreen;
		if (CurrentScreen != null)
		{
			try
			{
				SetIsEnabled(isEnabled: false);
				subScreen = await CurrentScreen.GetPreviousScreen();
			}
			finally
			{
				SetIsEnabled(isEnabled: true);
			}
		}
		if (subScreen == SubScreen.WizardCancel)
		{
			await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
		}
		else if (subScreen == SubScreen.WizardDone)
		{
			if (ProcessFromEcm)
			{
				new VB6DocumentAssociation().QueueMessageProcessed(_connectionStringService.Vb6ConnectionString, WorkQueueViewModel.ErxMessage.EcmDocumentId, (ProcessingDisposition)0);
				CloseView();
				return;
			}
			await _erxMessageService.DequeueCompleted();
			SetMessageProcessedInPages();
			await WorkQueueViewModel.CompleteCurrentAndDequeueNextMessage();
			await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
		}
		else if (subScreen.HasValue)
		{
			await SetCurrentScreen(subScreen.Value);
		}
	}

	private async Task Cancel()
	{
		if (!CloseIfWorkQueueScreen())
		{
			if (CurrentScreen != null)
			{
				CurrentScreen.ExecuteCloseActions();
			}
			await SetCurrentScreen(SubScreen.ShowWorkQueueScreen);
		}
	}

	private void Escape()
	{
		CloseIfWorkQueueScreen();
	}

	private bool CloseIfWorkQueueScreen()
	{
		//IL_003f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0045: Invalid comparison between Unknown and I4
		//IL_005c: Unknown result type (might be due to invalid IL or missing references)
		if (RenewScreenLoaded())
		{
			return true;
		}
		if (CurrentScreen != null && CurrentScreen.GetScreen() == SubScreen.ShowWorkQueueScreen)
		{
			if (WorkQueueViewModel.InClipProcess && (int)MessageBoxServicePlatformExtensions.Show(_messageBoxService, "All items in this clip have not been processed. If you quit, the remaining items will be placed back into the queue. Are you sure that you wish to quit?", "Abort Processing", (MessageBoxButton)4, (MessageBoxImage)48) != 6)
			{
				return false;
			}
			CurrentScreen.ExecuteCloseActions();
			if (ProcessFromEcm)
			{
				new VB6DocumentAssociation().QueueMessageProcessed(_connectionStringService.Vb6ConnectionString, WorkQueueViewModel.ErxMessage.EcmDocumentId, (ProcessingDisposition)2);
			}
			CloseView();
			return true;
		}
		return false;
	}

	public void SendFocusMessage(string controlToFocus, string controlToBounceFocusOn = "", bool force = false)
	{
		if (!force && _isInitializing)
		{
			return;
		}
		((DispatcherObject)Application.Current).Dispatcher.BeginInvoke((Delegate)(Action)(() =>
		{
			if (!string.IsNullOrWhiteSpace(controlToBounceFocusOn))
			{
				MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, controlToBounceFocusOn));
			}
			MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, controlToFocus));
		}), (DispatcherPriority)4, Array.Empty<object>());
	}
}
