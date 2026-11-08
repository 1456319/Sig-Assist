using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using SoftWriters.FrameworkLtc.Models.Drug;
using SoftWriters.FrameworkLtc.Models.ERx;
using SoftWriters.FrameworkLtc.Models.Enums;
using SoftWriters.FrameworkLtc.Models.Facility;
using SoftWriters.FrameworkLtc.ViewModels.Facility.PatientRxHistory;

namespace SoftWriters.FrameworkLtc.ViewModels.Prescriptions.ERxWorkQueue;

public class ERxWorkQueueProcessModel
{
	public string PharmId { get; set; }

	public string FacilityId { get; set; }

	public string NsId { get; set; }

	public string PatientId { get; set; }

	public string PatientFirstName { get; set; }

	public string PatientLastName { get; set; }

	public string MiddleInitial { get; set; }

	public DrugProductType ProductType
	{
		[CompilerGenerated]
		get
		{
			//IL_0001: Unknown result type (might be due to invalid IL or missing references)
			return field;
		}
		[CompilerGenerated]
		set
		{
			//IL_0001: Unknown result type (might be due to invalid IL or missing references)
			//IL_0002: Unknown result type (might be due to invalid IL or missing references)
			field = value;
		}
	}

	public string NDC { get; set; }

	public string DrugName { get; set; }

	public string DispensedFor { get; set; }

	public string CCID { get; set; }

	public string RxBatch { get; set; }

	public string RxBatchDescription { get; set; }

	public string FacName { get; set; }

	public string ExternalId { get; set; }

	public bool EPCS { get; set; }

	public bool GenericSub { get; set; }

	public bool SignaturePresent { get; set; }

	public bool SignatureValid { get; set; }

	public bool CertificatePresent { get; set; }

	public int RoNo { get; set; }

	public int RxNo { get; set; }

	public string AssocRoNo { get; set; }

	public bool LinkToAssocRo { get; set; }

	public DateTime? AssocRoCutDate { get; set; }

	public Guid MessageId { get; set; }

	public ERxWorkQueueMessageModel Message { get; set; }

	public bool SkippedPatientSelection { get; set; }

	public bool ProcessFromEcm { get; set; }

	public List<ERxDataItemViewModel> ErxMessageAsList { get; set; }

	public bool PatientOrdersVisited { get; set; }

	public bool PatientSelectionVisited { get; set; }

	public string MessageInterface { get; set; }

	public string MailboxId { get; set; }

	public HouseStockStatusResultModel HouseStockStatus { get; set; }

	public NonTherapeuticOverrideModel OverrideModel { get; set; }

	public BiosimilarInterchangeCommentModel BiosimilarCommentModel { get; set; }

	public string NDCInProdSelView { get; set; }

	public string DrugNameInProdSelView { get; set; }

	public bool ChangePatientFromAdmitView { get; set; }

	public ERxWorkQueueWizardViewModel.SubScreen? ScreenBeforeDirections { get; set; }

	public bool UpperCaseDirections { get; set; }

	public bool? ShowPatientOrdersScreen { get; set; }

	public bool BiosimilarSub { get; set; }

	public ERxNewRxRequestMessageData NewRxRequestData { get; set; }

	public ERxRefillResponseMessageData RefillResponseData { get; set; }

	public ERxCancelMessageData CancelMessageData { get; set; }

	public ERxResupplyMessageData ResupplyMessageData { get; set; }

	public ERxCensusMessageData CensusRequestData { get; set; }

	public CensusAdmitResultEnum CensusAdmitResult
	{
		[CompilerGenerated]
		get
		{
			//IL_0001: Unknown result type (might be due to invalid IL or missing references)
			return field;
		}
		[CompilerGenerated]
		set
		{
			//IL_0001: Unknown result type (might be due to invalid IL or missing references)
			//IL_0002: Unknown result type (might be due to invalid IL or missing references)
			field = value;
		}
	}

	public ERxHL7MessageData HL7RxMessageData { get; set; }

	public ERxRxFillIndicatorChangeMessageData RxFillIndicatorChangeRequestData { get; set; }

	public ERxRecertificationMessageData RecertificationRequestData { get; set; }

	public bool PaymentPlansCompleted { get; set; }

	public bool AllergiesCompleted { get; set; }

	public bool MedCondsCompleted { get; set; }

	public bool CensusChangesMade { get; set; }

	public bool PaymentPlansChanged { get; set; }

	public bool AllergiesChanged { get; set; }

	public bool MedCondsChanged { get; set; }

	public bool NsIDRoomChange { get; set; }

	public CreateRecallRxRequestModel RecallRxRequest { get; set; }

	public string FullName => PatientLastName + ((!string.IsNullOrEmpty(PatientLastName) && !string.IsNullOrEmpty(PatientFirstName)) ? ", " : string.Empty) + PatientFirstName + ((!string.IsNullOrEmpty(MiddleInitial)) ? $" {MiddleInitial}." : string.Empty);

	public List<ERxDataItemViewModel> GetERxGroupData(string groupName, bool highlightNotes)
	{
		int num = 0;
		if (ErxMessageAsList != null && (num = ErxMessageAsList.FindIndex((ERxDataItemViewModel e) => e.IsGroupHeader && e.Value.StartsWith(groupName, StringComparison.OrdinalIgnoreCase))) != -1)
		{
			List<ERxDataItemViewModel> list = new ERxDataItemViewModel[1] { ErxMessageAsList[num] }.Union(ErxMessageAsList.Skip(num + 1).TakeWhile((ERxDataItemViewModel e) => !e.IsGroupHeader)).ToList();
			{
				foreach (ERxDataItemViewModel item in list)
				{
					if (highlightNotes && string.Equals(item.Title, "notes", StringComparison.InvariantCultureIgnoreCase))
					{
						item.IsHighlighted = true;
					}
				}
				return list;
			}
		}
		return null;
	}

	public List<ERxDataItemViewModel> GetERxDrugInformationGroupData()
	{
		List<ERxDataItemViewModel> list = new List<ERxDataItemViewModel>();
		if (ErxMessageAsList != null && ErxMessageAsList.Any())
		{
			bool flag = true;
			bool flag2 = false;
			bool flag3 = false;
			bool flag4 = false;
			int num = 0;
			ERxDataItemViewModel eRxDataItemViewModel = new ERxDataItemViewModel();
			ERxDataItemViewModel eRxDataItemViewModel2 = new ERxDataItemViewModel();
			ERxDataItemViewModel eRxDataItemViewModel3 = new ERxDataItemViewModel();
			foreach (ERxDataItemViewModel erxMessageAs in ErxMessageAsList)
			{
				if (erxMessageAs.IsGroupHeader)
				{
					if (erxMessageAs.Value.EndsWith("(prescribed)", StringComparison.InvariantCultureIgnoreCase))
					{
						flag2 = true;
						flag4 = false;
						flag3 = false;
					}
					else if (erxMessageAs.Value.EndsWith("(dispensed)", StringComparison.InvariantCultureIgnoreCase))
					{
						flag3 = true;
						flag2 = false;
						flag4 = false;
					}
					else if (erxMessageAs.Value.StartsWith("Drug Information", StringComparison.InvariantCultureIgnoreCase))
					{
						flag4 = true;
						flag2 = false;
						flag3 = false;
					}
				}
				if (flag2 && (erxMessageAs.Title.Equals("directions", StringComparison.InvariantCultureIgnoreCase) || erxMessageAs.Title.Equals("sig text", StringComparison.InvariantCultureIgnoreCase)))
				{
					eRxDataItemViewModel = new ERxDataItemViewModel
					{
						Title = "Directions",
						Value = erxMessageAs.Value
					};
					flag2 = false;
				}
				else if (flag3 && (erxMessageAs.Title.Equals("directions", StringComparison.InvariantCultureIgnoreCase) || erxMessageAs.Title.Equals("sig text", StringComparison.InvariantCultureIgnoreCase)))
				{
					eRxDataItemViewModel2 = new ERxDataItemViewModel
					{
						Title = "Directions",
						Value = erxMessageAs.Value
					};
					flag3 = false;
				}
				else if (flag4 && (erxMessageAs.Title.Equals("directions", StringComparison.InvariantCultureIgnoreCase) || erxMessageAs.Title.Equals("sig text", StringComparison.InvariantCultureIgnoreCase)))
				{
					eRxDataItemViewModel3 = new ERxDataItemViewModel
					{
						Title = "Directions",
						Value = erxMessageAs.Value
					};
					flag4 = false;
				}
			}
			foreach (ERxDataItemViewModel erxMessageAs2 in ErxMessageAsList)
			{
				if (erxMessageAs2.IsGroupHeader)
				{
					flag2 = false;
					flag3 = false;
					flag4 = false;
					flag = !erxMessageAs2.Value.StartsWith("Drug Information", StringComparison.InvariantCultureIgnoreCase);
					if (!flag)
					{
						if (erxMessageAs2.Value.EndsWith("(prescribed)", StringComparison.InvariantCultureIgnoreCase))
						{
							flag2 = true;
						}
						else if (erxMessageAs2.Value.EndsWith("(dispensed)", StringComparison.InvariantCultureIgnoreCase))
						{
							flag3 = true;
						}
						else
						{
							flag4 = true;
						}
						num = 0;
					}
				}
				if (flag || erxMessageAs2.Title.Equals("directions", StringComparison.InvariantCultureIgnoreCase) || erxMessageAs2.Title.Equals("sig text", StringComparison.InvariantCultureIgnoreCase))
				{
					continue;
				}
				num++;
				erxMessageAs2.IsEvenRow = num % 2 != 0;
				list.Add(erxMessageAs2);
				if (string.Equals(erxMessageAs2.Title, "drug name", StringComparison.InvariantCultureIgnoreCase))
				{
					if (flag2 && eRxDataItemViewModel != null && !string.IsNullOrWhiteSpace(eRxDataItemViewModel.Value))
					{
						num++;
						eRxDataItemViewModel.IsEvenRow = num % 2 != 0;
						list.Add(eRxDataItemViewModel);
						flag2 = false;
					}
					else if (flag3 && eRxDataItemViewModel2 != null && !string.IsNullOrWhiteSpace(eRxDataItemViewModel2.Value))
					{
						num++;
						eRxDataItemViewModel2.IsEvenRow = num % 2 != 0;
						list.Add(eRxDataItemViewModel2);
						flag3 = false;
					}
					else if (flag4 && eRxDataItemViewModel3 != null && !string.IsNullOrWhiteSpace(eRxDataItemViewModel3.Value))
					{
						num++;
						eRxDataItemViewModel3.IsEvenRow = num % 2 != 0;
						list.Add(eRxDataItemViewModel3);
						flag4 = false;
					}
				}
			}
		}
		return list;
	}
}
