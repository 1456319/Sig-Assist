using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using DevExpress.Mvvm;
using SoftWriters.FrameworkLtc.ApiCalls;
using SoftWriters.FrameworkLtc.ApiCalls.ERx;
using SoftWriters.FrameworkLtc.ApiCalls.Facility;
using SoftWriters.FrameworkLtc.ApiCalls.Inventory;
using SoftWriters.FrameworkLtc.ApiCalls.Patient;
using SoftWriters.FrameworkLtc.ApiCalls.Pharmacy;
using SoftWriters.FrameworkLtc.ApiCalls.Prescriptions;
using SoftWriters.FrameworkLtc.ApiCalls.RX;
using SoftWriters.FrameworkLtc.Common.Infrastructure.Extensions;
using SoftWriters.FrameworkLtc.Domain.Entities.Framework.PAT;
using SoftWriters.FrameworkLtc.Extensions;
using SoftWriters.FrameworkLtc.Infrastructure.Commands;
using SoftWriters.FrameworkLtc.Infrastructure.Help;
using SoftWriters.FrameworkLtc.Messages.Views;
using SoftWriters.FrameworkLtc.Models.ERx;
using SoftWriters.FrameworkLtc.Models.Facility.Options;
using SoftWriters.FrameworkLtc.Models.Shared;
using SoftWriters.FrameworkLtc.Models.SystemOptions;
using SoftWriters.FrameworkLtc.Services;
using SoftWriters.FrameworkLtc.Services.ERx;
using SoftWriters.FrameworkLtc.Services.Sound;
using SoftWriters.FrameworkLtc.ViewModels.Shared;
using SoftWriters.FrameworkLtc.Views.Prescriptions;
using SoftWriters.FrameworkLtc.Views.Shared;

namespace SoftWriters.FrameworkLtc.ViewModels.Prescriptions.ERxWorkQueue;

public class ERxWorkQueueDirectionsViewModel : LtcViewModelBase<ERxWorkQueueDirectionsViewModel>, IERxWorkQueuePageViewModel
{
	public const string DialogTitle = "Prescription Directions";

	public const string ExpandedSigTitle = "Expanded Sig Text";

	public const string SeqLabelFormat = "{0} of {1}";

	public const string ValidationFailedDlgTitle = "Error";

	public const string DirectionsNotSpecifiedFormat = "Directions text must be specified {0}.";

	public const string OnAllSplits = " on all splits";

	public const string NoBatchSelection = "You must select the batch before you can continue.";

	private readonly IERxWorkQueueService _erxWorkQueueService;

	private readonly IApiCallExecutor _apiCallExecutor;

	private readonly IMessageBoxService _messageBoxService;

	private readonly IShowWindowService _showWindowService;

	private readonly IMessenger _messenger;

	private readonly ISoundService _soundService;

	private readonly ITranslateSigService _translateSigService;

	private int _currSplit;

	private int _currLinkedSplit;

	private bool _showStructuredSigForSigPreview;

	private string _rawMsgLoaded;

	private string _facIdLoaded;

	private string _patIdLoaded;

	private string _ndcLoaded;

	private string _ccidLoaded;

	private bool _dataLoaded;

	private bool _backButtonUsed;

	private IERxWorkQueueWizardViewModel _wizardViewModel;

	public ERxWorkQueueProcessModel ProcessModel { get; set; }

	public virtual bool ShowViewFlag { get; set; }

	public virtual string FacPatientNameId { get; set; }

	public virtual string DrugInformation { get; set; }

	public virtual bool UseMessageDirections { get; set; }

	public virtual string MessageDirections { get; set; }

	public virtual bool UseLinkedSig { get; set; }

	public virtual bool UseLinkedSigEnabled { get; set; }

	public virtual List<ReorderDirections> LinkedSigList { get; set; }

	public virtual bool PrevLinkedSplitEnabled { get; set; }

	public virtual bool NextLinkedSplitEnabled { get; set; }

	public virtual bool AllowLinkedSplits { get; set; }

	public virtual bool RemoveLinkedSplitEnabled { get; set; }

	public virtual string SequentialLinkedSigLabel { get; set; }

	public virtual StructuredSigModel LinkedSigDocument { get; set; }

	public virtual List<StructuredSigModel> StructuredLinkedSigDocuments { get; set; }

	public virtual bool SequentialLinkedSigs { get; set; }

	public virtual bool SequentialLinkedSigsEnabled { get; set; }

	public virtual bool UseDefaultDirections { get; set; }

	public virtual bool UseDefaultDirectionsEnabled { get; set; }

	public virtual string DefaultDirections { get; set; }

	public virtual string StructuredSig { get; set; }

	public virtual StructuredSigModel OrderSigDocument { get; set; }

	public virtual List<StructuredSigModel> StructuredSigDocuments { get; set; }

	public virtual bool IsAnyOrderSigUntranslated { get; set; }

	public virtual bool UseOrderSig { get; set; }

	public virtual bool UseOrderSigEnabled { get; set; }

	public virtual bool SequentialSigs { get; set; }

	public virtual bool SequentialSigsEnabled { get; set; }

	public virtual bool PrevSequentialSplitEnabled { get; set; }

	public virtual string SequentialSigLabel { get; set; }

	public virtual bool NextSequentialSplitEnabled { get; set; }

	public virtual bool OrderSigUpperCase { get; set; }

	public virtual bool RemoveSplitEnabled { get; set; }

	public virtual bool AppendDefaultEnabled { get; set; }

	public virtual ObservableCollection<GenericComboBoxModel> Batches { get; set; }

	public virtual string SelectedBatchId { get; set; }

	public virtual bool AllowMultipleSplits { get; set; }

	public virtual int SigCodeCursorLocation { get; set; }

	public virtual ICommand PrevSplitCommand { get; set; }

	public virtual ICommand NextSplitCommand { get; set; }

	public virtual ICommand AddSplitCommand { get; set; }

	public virtual ICommand RemoveSplitCommand { get; set; }

	public virtual IAsyncCommand PreviewSigCommand { get; set; }

	public virtual ICommand AppendDefaultCommand { get; set; }

	public virtual IAsyncCommand NewBatchCommand { get; set; }

	public virtual IAsyncCommand SelectSigCommand { get; set; }

	public virtual ICommand NextLinkedSplitCommand { get; set; }

	public virtual ICommand PrevLinkedSplitCommand { get; set; }

	public virtual ICommand AddLinkedSplitCommand { get; set; }

	public virtual ICommand RemoveLinkedSplitCommand { get; set; }

	public virtual IAsyncCommand PreviewLinkedSigCommand { get; set; }

	public virtual ICommand SelectLinkedSigCommand { get; set; }

	public int CurrSplit => _currSplit;

	public int LinkedCurrSplit => _currLinkedSplit;

	public ERxWorkQueueDirectionsViewModel(IERxWorkQueueService erxWorkQueueService, IApiCallExecutor apiCallExecutor, IMessageBoxService messageBoxService, IShowWindowService showWindowService, IMessenger messenger, ISoundService soundService, ITranslateSigService translateSigService)
	{
		//IL_0053: Unknown result type (might be due to invalid IL or missing references)
		//IL_005d: Expected Obj, but got Unknown
		//IL_006a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0074: Expected Obj, but got Unknown
		//IL_0081: Unknown result type (might be due to invalid IL or missing references)
		//IL_008b: Expected Obj, but got Unknown
		//IL_0098: Unknown result type (might be due to invalid IL or missing references)
		//IL_00a2: Expected Obj, but got Unknown
		//IL_00c6: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d0: Expected Obj, but got Unknown
		//IL_010b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0115: Expected Obj, but got Unknown
		//IL_0122: Unknown result type (might be due to invalid IL or missing references)
		//IL_012c: Expected Obj, but got Unknown
		//IL_0139: Unknown result type (might be due to invalid IL or missing references)
		//IL_0143: Expected Obj, but got Unknown
		//IL_0150: Unknown result type (might be due to invalid IL or missing references)
		//IL_015a: Expected Obj, but got Unknown
		_erxWorkQueueService = erxWorkQueueService;
		_apiCallExecutor = apiCallExecutor;
		_messageBoxService = messageBoxService;
		_showWindowService = showWindowService;
		_messenger = messenger;
		_soundService = soundService;
		_translateSigService = translateSigService;
		Batches = new ObservableCollection<GenericComboBoxModel>();
		PrevSplitCommand = (ICommand)new DelegateCommand((Action)PrevSplit);
		NextSplitCommand = (ICommand)new DelegateCommand((Action)NextSplit);
		AddSplitCommand = (ICommand)new DelegateCommand((Action)AddSplit);
		RemoveSplitCommand = (ICommand)new DelegateCommand((Action)RemoveSplit);
		PreviewSigCommand = new AsyncDelegateCommand(() => PreviewSig(StructuredSigDocuments, SequentialSigs));
		AppendDefaultCommand = (ICommand)new DelegateCommand((Action)AppendDefault);
		NewBatchCommand = new AsyncDelegateCommand(NewBatch);
		SelectSigCommand = new AsyncDelegateCommand(SelectSig);
		NextLinkedSplitCommand = (ICommand)new DelegateCommand((Action)NextLinkedSplit);
		PrevLinkedSplitCommand = (ICommand)new DelegateCommand((Action)PrevLinkedSplit);
		AddLinkedSplitCommand = (ICommand)new DelegateCommand((Action)AddLinkedSplit);
		RemoveLinkedSplitCommand = (ICommand)new DelegateCommand((Action)RemoveLinkedSplit);
		PreviewLinkedSigCommand = new AsyncDelegateCommand(() => PreviewSig(StructuredLinkedSigDocuments, SequentialLinkedSigs));
		SelectLinkedSigCommand = new AsyncDelegateCommand(SelectLinkedSig);
	}

	public async Task NewBatch()
	{
		string newBatchId = (await _showWindowService.ShowMdiDialog<CreatePrescriptionBatchView, CreatePrescriptionBatchViewModel, string>((ILtcViewModelBase)this, (Action<CreatePrescriptionBatchViewModel>)((CreatePrescriptionBatchViewModel vm) =>
		{
			vm.UseHelperDialog = false;
			vm.FacilityId = ProcessModel.FacilityId;
		}), (Point?)null)).SafeTrim();
		if (newBatchId != null)
		{
			await FillBatchList();
			SelectedBatchId = newBatchId;
		}
	}

	private async Task PreviewSig(List<StructuredSigModel> sigDocuments, bool sequentialSigs)
	{
		if (!_showStructuredSigForSigPreview)
		{
			StringBuilder stringBuilder = new StringBuilder();
			foreach (StructuredSigModel sigDocument in sigDocuments)
			{
				if (stringBuilder.Length > 0)
				{
					stringBuilder.Append(" ; ");
				}
				stringBuilder.Append(sigDocument.GetText());
			}
			string input = stringBuilder.ToString();
			string text = await _translateSigService.Translate(input);
			MessageBoxServicePlatformExtensions.Show(_messageBoxService, text, "Expanded Sig Text", (MessageBoxButton)0);
			return;
		}
		List<string> sigList = new List<string>();
		foreach (StructuredSigModel sigDocument2 in sigDocuments)
		{
			if (!sigDocument2.IsEmpty())
			{
				sigList.Add(sigDocument2.GetText());
			}
		}
		_showWindowService.ShowDialog<StructuredSigModalView, StructuredSigViewModel>((ILtcViewModelBase)this, (Action<StructuredSigViewModel>)((StructuredSigViewModel vm) =>
		{
			vm.ConfigureViewModel(sigList, sequentialSigs);
		}));
	}

	public void AppendDefault()
	{
		string text = (OrderSigUpperCase ? DefaultDirections.ToUpper() : DefaultDirections);
		StructuredSigDocuments[_currSplit].Elements.Add(new StructuredSigModel.Element
		{
			Text = (StructuredSigDocuments[_currSplit].IsEmpty() ? "" : " ") + text
		});
		foreach (StructuredSigModel.Element element in StructuredSigDocuments[_currSplit].Elements)
		{
			element.Untranslated = false;
		}
		OrderSigDocument = StructuredSigDocuments[_currSplit];
	}

	public void AddSplit()
	{
		StructuredSigModel structuredSigModel = new StructuredSigModel();
		StructuredSigDocuments.Add(structuredSigModel);
		_currSplit = StructuredSigDocuments.Count - 1;
		OrderSigDocument = structuredSigModel;
		RemoveSplitEnabled = true;
		SequentialSigsEnabled = true;
		SetSplitSigLabelText();
		MessengerExtensions.Send<FocusOrderSigMessage>(_messenger, new FocusOrderSigMessage());
	}

	public void RemoveSplit()
	{
		if (StructuredSigDocuments.Count == 1)
		{
			_soundService.Beep();
			return;
		}
		StructuredSigDocuments.RemoveAt(_currSplit);
		if (_currSplit >= StructuredSigDocuments.Count)
		{
			_currSplit = StructuredSigDocuments.Count - 1;
		}
		OrderSigDocument = StructuredSigDocuments[_currSplit];
		if (StructuredSigDocuments.Count == 1)
		{
			RemoveSplitEnabled = false;
			SequentialSigs = false;
			SequentialSigsEnabled = false;
		}
		SetSplitSigLabelText();
		MessengerExtensions.Send<FocusOrderSigMessage>(_messenger, new FocusOrderSigMessage());
	}

	private void PrevSplit()
	{
		if (_currSplit == 0)
		{
			_soundService.Beep();
			return;
		}
		_currSplit--;
		OrderSigDocument = StructuredSigDocuments[_currSplit];
		SetSplitSigLabelText();
		MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, "NextSplitCommand"));
	}

	private void NextSplit()
	{
		if (_currSplit >= StructuredSigDocuments.Count - 1)
		{
			_soundService.Beep();
			return;
		}
		_currSplit++;
		OrderSigDocument = StructuredSigDocuments[_currSplit];
		SetSplitSigLabelText();
		MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, "PrevSplitCommand"));
	}

	public void AddLinkedSplit()
	{
		StructuredSigModel structuredSigModel = new StructuredSigModel();
		StructuredLinkedSigDocuments.Add(structuredSigModel);
		_currLinkedSplit = StructuredLinkedSigDocuments.Count - 1;
		LinkedSigDocument = structuredSigModel;
		RemoveLinkedSplitEnabled = true;
		SequentialLinkedSigsEnabled = true;
		SetLinkedSigLabelText();
		MessengerExtensions.Send<FocusLinkedSigMessage>(_messenger, new FocusLinkedSigMessage());
	}

	public void RemoveLinkedSplit()
	{
		if (StructuredLinkedSigDocuments.Count == 1)
		{
			_soundService.Beep();
			return;
		}
		StructuredLinkedSigDocuments.RemoveAt(_currLinkedSplit);
		if (_currLinkedSplit >= StructuredLinkedSigDocuments.Count)
		{
			_currLinkedSplit = StructuredLinkedSigDocuments.Count - 1;
		}
		LinkedSigDocument = StructuredLinkedSigDocuments[_currLinkedSplit];
		if (StructuredLinkedSigDocuments.Count == 1)
		{
			RemoveLinkedSplitEnabled = false;
			SequentialLinkedSigs = false;
			SequentialLinkedSigsEnabled = false;
		}
		SetLinkedSigLabelText();
		MessengerExtensions.Send<FocusLinkedSigMessage>(_messenger, new FocusLinkedSigMessage());
	}

	private void PrevLinkedSplit()
	{
		if (_currLinkedSplit == 0)
		{
			_soundService.Beep();
			return;
		}
		_currLinkedSplit--;
		LinkedSigDocument = StructuredLinkedSigDocuments[_currLinkedSplit];
		SetLinkedSigLabelText();
		MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, "NextLinkedSplitCommand"));
	}

	private void NextLinkedSplit()
	{
		if (_currLinkedSplit >= StructuredLinkedSigDocuments.Count - 1)
		{
			_soundService.Beep();
			return;
		}
		_currLinkedSplit++;
		LinkedSigDocument = StructuredLinkedSigDocuments[_currLinkedSplit];
		SetLinkedSigLabelText();
		MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(this, "PrevLinkedSplitCommand"));
	}

	private void SetLinkedSigLabelText()
	{
		PrevLinkedSplitEnabled = _currLinkedSplit > 0;
		NextLinkedSplitEnabled = _currLinkedSplit < StructuredLinkedSigDocuments.Count - 1;
		SequentialLinkedSigLabel = $"{_currLinkedSplit + 1} of {StructuredLinkedSigDocuments.Count}";
	}

	public override List<ValidationResult> GetValidationResults()
	{
		List<ValidationResult> validationResults = base.GetValidationResults();
		if (UseOrderSig && StructuredSigDocuments.Any((StructuredSigModel p) => p.IsEmpty()))
		{
			string errorMessage = string.Format("Directions text must be specified {0}.", (StructuredSigDocuments.Count > 1) ? " on all splits" : "");
			validationResults.Add(errorMessage, () => OrderSigDocument);
		}
		if (UseLinkedSig && StructuredLinkedSigDocuments.Any((StructuredSigModel p) => p.IsEmpty()))
		{
			string errorMessage2 = string.Format("Directions text must be specified {0}.", (StructuredLinkedSigDocuments.Count > 1) ? " on all splits" : "");
			validationResults.Add(errorMessage2, () => LinkedSigDocument);
		}
		if (string.IsNullOrWhiteSpace(SelectedBatchId))
		{
			validationResults.Add("You must select the batch before you can continue.", () => SelectedBatchId);
		}
		return validationResults;
	}

	public async Task<ERxWorkQueueWizardViewModel.SubScreen?> GetNextScreen()
	{
		if (!(await DoValidation("Error", _messageBoxService)))
		{
			return null;
		}
		if (UseOrderSig)
		{
			List<string> list = new List<string>();
			foreach (StructuredSigModel structuredSigDocument in StructuredSigDocuments)
			{
				list.Add(structuredSigDocument.GetText());
			}
			ProcessModel.NewRxRequestData.RxDirections = list;
			ProcessModel.NewRxRequestData.SequentialSigs = SequentialSigs;
		}
		else if (UseLinkedSig)
		{
			List<string> list2 = new List<string>();
			foreach (StructuredSigModel structuredLinkedSigDocument in StructuredLinkedSigDocuments)
			{
				list2.Add(structuredLinkedSigDocument.GetText());
			}
			ProcessModel.NewRxRequestData.RxDirections = list2;
			ProcessModel.NewRxRequestData.SequentialSigs = SequentialLinkedSigs;
		}
		else if (UseDefaultDirections)
		{
			ProcessModel.NewRxRequestData.RxDirections = new List<string> { CommonStringExtensions.Truncate(DefaultDirections, 256) };
		}
		else
		{
			ProcessModel.NewRxRequestData.RxDirections = new List<string> { MessageDirections };
			ProcessModel.NewRxRequestData.SequentialSigs = false;
		}
		Task<string> getRxBatchDescriptionTask = _apiCallExecutor.ExecuteAsync(new GetRxBatchDescription(ProcessModel.FacilityId, SelectedBatchId));
		Task<string> getDispensingPharmacyTask = _apiCallExecutor.ExecuteAsync(new GetDispensingPharmacy(ProcessModel.FacilityId, SelectedBatchId));
		await Task.WhenAll(new Task<string>[2] { getRxBatchDescriptionTask, getDispensingPharmacyTask });
		ProcessModel.RxBatch = SelectedBatchId;
		_wizardViewModel.ERxBatch = SelectedBatchId;
		ProcessModel.RxBatchDescription = getRxBatchDescriptionTask.Result;
		ProcessModel.PharmId = getDispensingPharmacyTask.Result;
		ProcessModel.UpperCaseDirections = OrderSigUpperCase;
		return await _erxWorkQueueService.ProcessNewRx((ILtcViewModelBase)_wizardViewModel, ProcessModel);
	}

	public Task<ERxWorkQueueWizardViewModel.SubScreen?> GetPreviousScreen()
	{
		_backButtonUsed = true;
		if (!ProcessModel.ScreenBeforeDirections.HasValue)
		{
			return Task.FromResult((ERxWorkQueueWizardViewModel.SubScreen?)ERxWorkQueueWizardViewModel.SubScreen.ShowProductSelectionScreen);
		}
		return Task.FromResult(ProcessModel.ScreenBeforeDirections);
	}

	private async Task Load()
	{
		_ = 8;
		try
		{
			IERxWorkQueueWizardViewModel wizardViewModel = _wizardViewModel;
			bool backEnabled = (_wizardViewModel.NextEnabled = false);
			wizardViewModel.BackEnabled = backEnabled;
			ILtcViewModelBase ltcViewModelBase = (ILtcViewModelBase)_wizardViewModel;
			HelpFileContext helpFileContext = (HelpFileContext = HelpFileContext.ERX_Directions);
			ltcViewModelBase.HelpFileContext = helpFileContext;
			if (_dataLoaded && string.Equals(ProcessModel.PatientId, _patIdLoaded, StringComparison.OrdinalIgnoreCase) && string.Equals(ProcessModel.FacilityId, _facIdLoaded, StringComparison.OrdinalIgnoreCase) && string.Equals(_rawMsgLoaded, ProcessModel.Message.RawMessage, StringComparison.OrdinalIgnoreCase) && string.Equals(_ndcLoaded, ProcessModel.NDC, StringComparison.OrdinalIgnoreCase) && string.Equals(_ccidLoaded, ProcessModel.CCID) && !_backButtonUsed)
			{
				return;
			}
			_backButtonUsed = false;
			FacPatientNameId = string.Format("{0} - {1},{2}  ({3})", new object[4] { ProcessModel.FacilityId, ProcessModel.PatientLastName, ProcessModel.PatientFirstName, ProcessModel.PatientId });
			DrugInformation = $"{(string.IsNullOrWhiteSpace(ProcessModel.NDC) ? ProcessModel.CCID : ProcessModel.NDC)} - {ProcessModel.DrugName}";
			MessageDirections = ProcessModel.NewRxRequestData.MsgSig;
			UseMessageDirections = true;
			UseOrderSigEnabled = true;
			SequentialSigs = false;
			UseLinkedSigEnabled = false;
			LinkedSigDocument = new StructuredSigModel();
			SequentialLinkedSigs = false;
			StructuredLinkedSigDocuments = new List<StructuredSigModel>();
			_currLinkedSplit = 0;
			DefaultDirections = await _apiCallExecutor.ExecuteAsync(new GetDefaultSig(ProcessModel.PharmId, ProcessModel.NDC, ProcessModel.CCID));
			UseDefaultDirectionsEnabled = !string.IsNullOrWhiteSpace(DefaultDirections);
			PrevSequentialSplitEnabled = false;
			NextSequentialSplitEnabled = false;
			AppendDefaultEnabled = !string.IsNullOrWhiteSpace(DefaultDirections);
			if (!string.IsNullOrWhiteSpace(ProcessModel.AssocRoNo) && int.TryParse(ProcessModel.AssocRoNo, out var tempRoNo))
			{
				LinkedSigList = await _apiCallExecutor.ExecuteAsync(new GetPatientReorderDirectionsList(ProcessModel.FacilityId, ProcessModel.PatientId, tempRoNo));
				UseLinkedSigEnabled = LinkedSigList.Any((ReorderDirections s) => !string.IsNullOrWhiteSpace(s.Sig)) && ProcessModel.LinkToAssocRo;
				if (UseLinkedSigEnabled)
				{
					SequentialLinkedSigs = await _apiCallExecutor.ExecuteAsync(new GetPatientReorderDirectionsSequential(ProcessModel.FacilityId, ProcessModel.PatientId, tempRoNo));
					foreach (ReorderDirections linkedSig in LinkedSigList)
					{
						StructuredSigModel structuredSigModel = new StructuredSigModel();
						structuredSigModel.Elements.Add(new StructuredSigModel.Element
						{
							Text = linkedSig.Sig
						});
						StructuredLinkedSigDocuments.Add(structuredSigModel);
					}
					LinkedSigDocument = StructuredLinkedSigDocuments[0];
				}
			}
			OrderSigUpperCase = (await _apiCallExecutor.ExecuteAsync(new GetSystemOptionByName((SystemOptionNames)404))).ValueAsBoolean();
			_showStructuredSigForSigPreview = (await _apiCallExecutor.ExecuteAsync(new GetFacilityOptionValueByName(ProcessModel.FacilityId, (FacilityOptionNames)51))).ValueAsBoolean();
			AllowMultipleSplits = true;
			if ((int)ProcessModel.ProductType == 2)
			{
				AllowMultipleSplits = false;
			}
			else if (await _apiCallExecutor.ExecuteAsync(new IsFacilityRetail(ProcessModel.FacilityId)))
			{
				AllowMultipleSplits = false;
			}
			AllowLinkedSplits = AllowMultipleSplits && UseLinkedSigEnabled;
			if (AllowLinkedSplits)
			{
				RemoveLinkedSplitEnabled = StructuredLinkedSigDocuments.Count > 1;
				SequentialLinkedSigsEnabled = StructuredLinkedSigDocuments.Count > 1;
				SetLinkedSigLabelText();
			}
			StructuredSigDocuments = new List<StructuredSigModel>();
			if (await UseStructuredSig())
			{
				await LoadStructuredSig();
			}
			else
			{
				StructuredSig = string.Empty;
			}
			_currSplit = 0;
			if (StructuredSigDocuments.Count < 1)
			{
				StructuredSigDocuments.Add(new StructuredSigModel());
			}
			IsAnyOrderSigUntranslated = StructuredSigDocuments.Any((StructuredSigModel p) => p.HasUntranslated());
			OrderSigDocument = StructuredSigDocuments[0];
			RemoveSplitEnabled = StructuredSigDocuments.Count > 1;
			SequentialSigsEnabled = StructuredSigDocuments.Count > 1;
			SetSplitSigLabelText();
			await FillBatchList();
			_rawMsgLoaded = ProcessModel.Message.RawMessage;
			_patIdLoaded = ProcessModel.PatientId;
			_facIdLoaded = ProcessModel.FacilityId;
			_ndcLoaded = ProcessModel.NDC;
			_ccidLoaded = ProcessModel.CCID;
			_dataLoaded = true;
		}
		finally
		{
			((DispatcherObject)Application.Current).Dispatcher.BeginInvoke((Delegate)(Action)(() =>
			{
				MessengerExtensions.Send<FocusBoundItemMessage>(_messenger, new FocusBoundItemMessage(OrderSigDocument, "OrderSigDocument"));
			}), (DispatcherPriority)5, Array.Empty<object>());
			IERxWorkQueueWizardViewModel wizardViewModel2 = _wizardViewModel;
			bool backEnabled = (_wizardViewModel.NextEnabled = true);
			wizardViewModel2.BackEnabled = backEnabled;
		}
	}

	private void SetSplitSigLabelText()
	{
		PrevSequentialSplitEnabled = _currSplit > 0;
		NextSequentialSplitEnabled = _currSplit < StructuredSigDocuments.Count - 1;
		SequentialSigLabel = $"{_currSplit + 1} of {StructuredSigDocuments.Count}";
	}

	private async Task LoadStructuredSig()
	{
		StringBuilder structuredSig = new StringBuilder();
		ERxTranslateStructuredSigResultModel val = await _erxWorkQueueService.LoadStructuredSig(ProcessModel.Message.RawMessage);
		if (val != null && val.SigList != null && val.SigList.Any())
		{
			string text = "";
			StructuredSigModel structuredSigModel = new StructuredSigModel();
			for (int i = 0; i < val.SigList.Count; i++)
			{
				StructuredSig val2 = val.SigList[i];
				structuredSig.Append(val2.SigFreeText);
				if (val.SigList.Count > 1 && i < val.SigList.Count - 1)
				{
					structuredSig.Append(Environment.NewLine);
					if (!string.IsNullOrEmpty(val2.MultipleSigModifier))
					{
						structuredSig.Append(Environment.NewLine + val2.MultipleSigModifier + Environment.NewLine);
					}
					structuredSig.Append(Environment.NewLine);
				}
				if (AllowMultipleSplits)
				{
					foreach (SigElement item in val2.Sig)
					{
						structuredSigModel.Elements.Add(new StructuredSigModel.Element
						{
							Text = item.Text,
							Untranslated = item.Untranslated
						});
					}
					StructuredSigDocuments.Add(structuredSigModel);
					structuredSigModel = new StructuredSigModel();
				}
				else
				{
					if (i > 0)
					{
						if (!string.IsNullOrWhiteSpace(text))
						{
							structuredSigModel.Elements.Add(new StructuredSigModel.Element
							{
								Text = " " + text + " "
							});
						}
						else
						{
							structuredSigModel.Elements.Add(new StructuredSigModel.Element
							{
								Text = " ; "
							});
						}
					}
					foreach (SigElement item2 in val2.Sig)
					{
						structuredSigModel.Elements.Add(new StructuredSigModel.Element
						{
							Text = item2.Text,
							Untranslated = item2.Untranslated
						});
					}
				}
				text = val2.MultipleSigModifier;
			}
			if (AllowMultipleSplits && string.Equals(val.SigList[0].MultipleSigModifier, "THEN", StringComparison.InvariantCultureIgnoreCase))
			{
				SequentialSigs = true;
			}
			UseOrderSig = true;
		}
		StructuredSig = structuredSig.ToString();
	}

	private async Task FillBatchList()
	{
		Batches.Clear();
		List<GenericComboBoxModel> list = await _apiCallExecutor.ExecuteAsync(new GetRxBatchesByFacility(ProcessModel.FacilityId));
		list.ForEach((GenericComboBoxModel b) =>
		{
			Batches.Add(b);
		});
		SelectedBatchId = _wizardViewModel.ERxBatchIfInList(list);
	}

	private async Task<bool> UseStructuredSig()
	{
		return await _apiCallExecutor.ExecuteAsync(new ERxUseStructuredSig(ProcessModel.MessageId));
	}

	private async Task SelectSig()
	{
		List<GenericComboBoxModel> sigCodes = await _apiCallExecutor.ExecuteAsync(new GetSigCodesComboBoxModels());
		GenericComboBoxModel val = _showWindowService.ShowDialog<SelectGenericWindow, SelectGenericViewModel<GenericComboBoxModel>, GenericComboBoxModel>((ILtcViewModelBase)this, (Action<SelectGenericViewModel<GenericComboBoxModel>>)((SelectGenericViewModel<GenericComboBoxModel> m) =>
		{
			m.Seed(sigCodes, showCaptions: false, dialogResizable: true);
		}));
		if (val != null)
		{
			StructuredSigModel structuredSigModel = StructuredSigDocuments[CurrSplit];
			structuredSigModel.Elements.Add(new StructuredSigModel.Element
			{
				Text = val.Id.ToString()
			});
			OrderSigDocument = null;
			OrderSigDocument = structuredSigModel;
		}
	}

	private async Task SelectLinkedSig()
	{
		List<GenericComboBoxModel> sigCodes = await _apiCallExecutor.ExecuteAsync(new GetSigCodesComboBoxModels());
		GenericComboBoxModel val = _showWindowService.ShowDialog<SelectGenericWindow, SelectGenericViewModel<GenericComboBoxModel>, GenericComboBoxModel>((ILtcViewModelBase)this, (Action<SelectGenericViewModel<GenericComboBoxModel>>)((SelectGenericViewModel<GenericComboBoxModel> m) =>
		{
			m.Seed(sigCodes, showCaptions: false, dialogResizable: true);
		}));
		if (val != null)
		{
			StructuredSigModel structuredSigModel = StructuredLinkedSigDocuments[LinkedCurrSplit];
			structuredSigModel.Elements.Add(new StructuredSigModel.Element
			{
				Text = val.Id.ToString()
			});
			LinkedSigDocument = null;
			LinkedSigDocument = structuredSigModel;
		}
	}

	public ERxWorkQueueWizardViewModel.SubScreen GetScreen()
	{
		return ERxWorkQueueWizardViewModel.SubScreen.ShowDirections;
	}

	public string GetDialogTitle()
	{
		return "Prescription Directions";
	}

	public async Task ShowView()
	{
		ShowViewFlag = true;
		_wizardViewModel.BackCommandText = "_Back";
		_wizardViewModel.NextCommandText = "_Next";
		_wizardViewModel.CancelCommandText = "_Cancel";
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
		_dataLoaded = false;
	}

	public void SetWizardReference(IERxWorkQueueWizardViewModel wizardViewModel)
	{
		_wizardViewModel = wizardViewModel;
	}

	public void ExecuteCloseActions()
	{
	}
}
