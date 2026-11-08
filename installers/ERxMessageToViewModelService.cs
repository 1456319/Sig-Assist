using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using HL7FwLink;
using SCRIPT;
using SoftWriters.FrameworkLtc.Common.Extensions;
using SoftWriters.FrameworkLtc.Common.Infrastructure.Extensions;
using SoftWriters.FrameworkLtc.Common.Services.Database;
using SoftWriters.FrameworkLtc.Extensions;
using SoftWriters.FrameworkLtc.Models.ERx;
using SoftWriters.FrameworkLtc.Models.Enums;
using SoftWriters.FrameworkLtc.Models.Enums.ERx;
using SoftWriters.FrameworkLtc.Models.Infrastructure.Extensions;
using SoftWriters.FrameworkLtc.Models.Patient;
using SoftWriters.FrameworkLtc.ViewModels.Facility.PatientRxHistory;

namespace SoftWriters.FrameworkLtc.Services.ERx;

public class ERxMessageToViewModelService : IERxMessageToViewModelService
{
	private const string NotesFieldName = "notes";

	private const string FieldFormat = "{0} - {1}";

	private const string HeaderStyle = "H";

	private const string AcceptedStyle = "A";

	private const string DeniedStyle = "D";

	private const string CutOffDateFormatWithTime = "DT";

	private readonly string _connectionString;

	private const int AutoProcessedAdminTimeSplitNumber = 1;

	private ERxMessageTypes _msgType;

	private string _rawMessage;

	private NEWRXRequest _newRxRequest;

	private RxCancelRequestMessage _canRxRequest;

	private RefillResponseMessage _refresMessage;

	private RefillRequestMessage _refreqMessage;

	private ResupplyMessage _resuppMessage;

	private CensusRequest _censusRequest;

	private RxFillIndicatorChangeMessage _rxFillIndicatorChangeMessage;

	private RecertificationMessage _recertificationMessage;

	private RxChangeResponseMessage _chgresMessage;

	private RxChangeRequestMessage _chgreqMessage;

	private IncomingMessage _incMessage;

	private NewOrder _newOrder;

	private RxCancelResponseMessage _cancelRxResponse;

	public ERxMessageToViewModelService(IDatabaseConnectionStringService connectionStringservice)
	{
		_connectionString = connectionStringservice.Vb6ConnectionString;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromResupplyMessage(string message)
	{
		List<ERxDataItemViewModel> viewModelsFromResupplyMessage = GetViewModelsFromResupplyMessage(null, message, out var _);
		viewModelsFromResupplyMessage.ResolveEvenRows();
		return viewModelsFromResupplyMessage;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromResupplyMessage(ERxResupplyMessageData resupplyData, string message, out bool signatureFlag)
	{
		SetInternalMessage((ERxMessageTypes)8, message);
		signatureFlag = _resuppMessage.SignatureFlag;
		FieldCollection fields = _resuppMessage.GetFields();
		List<ERxDataItemViewModel> list = new List<ERxDataItemViewModel>();
		if (resupplyData != null && resupplyData.IsValid)
		{
			list.Add(new ERxDataItemViewModel
			{
				Title = "",
				Value = "FrameworkLTC Order Information",
				IsGroupHeader = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Facility",
				Value = resupplyData.FacName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Patient",
				Value = $"{resupplyData.PatName} ({resupplyData.PatID})",
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			string value = resupplyData.RoNo.ToString();
			list.Add(new ERxDataItemViewModel
			{
				Title = "Reorder #",
				Value = value,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Drug",
				Value = resupplyData.DrugName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
		}
		list.AddRange((from Field field in (IEnumerable)fields
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList());
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromHl7RxMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)4, message);
		List<ERxDataItemViewModel> list = (from DisplayField field in (IEnumerable)_newOrder.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxMessage(string message)
	{
		List<ERxDataItemViewModel> viewModelsFromRxMessage = GetViewModelsFromRxMessage(message, out var _);
		viewModelsFromRxMessage.ResolveEvenRows();
		return viewModelsFromRxMessage;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxMessage(string message, out bool signatureFlag)
	{
		SetInternalMessage((ERxMessageTypes)5, message);
		signatureFlag = _newRxRequest.SignatureFlag;
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_newRxRequest.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsHighlighted = (field.Name == "Notes"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public bool GetMessageSignatureFlag(string message)
	{
		SetInternalMessage((ERxMessageTypes)5, message);
		return _newRxRequest.SignatureFlag;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRefillResponseMessage(ERxMessageTypes msgType, string message)
	{
		//IL_0001: Unknown result type (might be due to invalid IL or missing references)
		List<ERxDataItemViewModel> viewModelsFromRefillResponseMessage = GetViewModelsFromRefillResponseMessage(msgType, null, message, out var _, out var _);
		viewModelsFromRefillResponseMessage.ResolveEvenRows();
		return viewModelsFromRefillResponseMessage;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRefillResponseMessage(ERxMessageTypes msgType, ERxRefillResponseMessageData refillData, string message, out string responseStatusCode, out bool signatureFlag)
	{
		//IL_000e: Unknown result type (might be due to invalid IL or missing references)
		SetInternalMessage(msgType, message);
		signatureFlag = _refresMessage.SignatureFlag;
		responseStatusCode = _refresMessage.ResponseStatusCode;
		FieldCollection fields = _refresMessage.GetFields();
		List<ERxDataItemViewModel> list = new List<ERxDataItemViewModel>();
		if (refillData != null)
		{
			list.Add(new ERxDataItemViewModel
			{
				Title = "",
				Value = "FrameworkLTC Order Information",
				IsGroupHeader = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Facility",
				Value = refillData.FacilityName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			string value = (refillData.IsValid ? $"{refillData.PatientName} ({refillData.PatientId})" : "");
			list.Add(new ERxDataItemViewModel
			{
				Title = "Patient",
				Value = value,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			string value2 = (refillData.IsValid ? refillData.RoNo.ToString() : "*** ORDER NOT FOUND ***");
			list.Add(new ERxDataItemViewModel
			{
				Title = "Reorder #",
				Value = value2,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Drug",
				Value = refillData.DrugName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Directions",
				Value = refillData.Directions,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Refills Requested",
				Value = refillData.RefillsRequested.ToString(),
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
		}
		list.AddRange((from Field field in (IEnumerable)fields
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsHighlighted = (refillData != null && string.Equals(field.Name, "notes", StringComparison.OrdinalIgnoreCase) && string.Equals(refillData.ResponseStatusCode, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)4), StringComparison.OrdinalIgnoreCase)),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList());
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRefillRequestMessage(ERxMessageTypes msgType, string message)
	{
		//IL_0001: Unknown result type (might be due to invalid IL or missing references)
		SetInternalMessage(msgType, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_refreqMessage.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxCancelRequestMessage(string message)
	{
		List<ERxDataItemViewModel> viewModelsFromRxCancelRequestMessage = GetViewModelsFromRxCancelRequestMessage(null, message);
		viewModelsFromRxCancelRequestMessage.ResolveEvenRows();
		return viewModelsFromRxCancelRequestMessage;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxCancelRequestMessage(ERxCancelMessageData cancelData, string message)
	{
		SetInternalMessage((ERxMessageTypes)1, message);
		FieldCollection fields = _canRxRequest.GetFields();
		List<ERxDataItemViewModel> list = new List<ERxDataItemViewModel>();
		if (cancelData != null)
		{
			if (cancelData.IsValid)
			{
				list.Add(new ERxDataItemViewModel
				{
					Title = "",
					Value = "FrameworkLTC Order Information",
					IsGroupHeader = true
				});
				list.Add(new ERxDataItemViewModel
				{
					Title = "Facility",
					Value = cancelData.FacilityName,
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
				string value = (cancelData.IsValid ? $"{cancelData.PatientName} ({cancelData.PatientId})" : "");
				list.Add(new ERxDataItemViewModel
				{
					Title = "Patient",
					Value = value,
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
				string value2 = cancelData.RoNo.ToString();
				list.Add(new ERxDataItemViewModel
				{
					Title = "Reorder #",
					Value = value2,
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
				list.Add(new ERxDataItemViewModel
				{
					Title = "Drug",
					Value = cancelData.DrugName,
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
				list.Add(new ERxDataItemViewModel
				{
					Title = "Directions",
					Value = cancelData.Directions,
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
			}
			else
			{
				list.Add(new ERxDataItemViewModel
				{
					Title = "",
					Value = "Cancel Order Information",
					IsGroupHeader = true
				});
			}
			list.Add(new ERxDataItemViewModel
			{
				Title = "Type",
				Value = ((cancelData.CancelType == EnumExtensions.GetDatabaseValue((Enum)(object)(ERxCancelType)0)) ? CommonEnumExtensions.GetDescription((Enum)(object)(ERxCancelType)0) : CommonEnumExtensions.GetDescription((Enum)(object)(ERxCancelType)1)),
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			if (cancelData.CancelType == EnumExtensions.GetDatabaseValue((Enum)(object)(ERxCancelType)1))
			{
				list.Add(new ERxDataItemViewModel
				{
					Title = "Discontinue Date",
					Value = ((cancelData.CutoffDateFormat == "DT") ? cancelData.CutoffDate.ToString("MM/dd/yyyy hh:mm") : cancelData.CutoffDate.ToString("MM/dd/yyyy")),
					IsGroupHeader = false,
					IsAlternatingBlue = true
				});
			}
		}
		list.AddRange((from Field field in (IEnumerable)fields
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList());
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxCancelResponseMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)0, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_cancelRxResponse.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxCensusRequestMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)2, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_censusRequest.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxChangeResponseMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)12, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_chgresMessage.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxChangeRequestMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)11, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_chgreqMessage.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxIncomingMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)3, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_incMessage.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRxFillIndicatorChangeMessage(string message)
	{
		SetInternalMessage((ERxMessageTypes)13, message);
		List<ERxDataItemViewModel> list = (from Field field in (IEnumerable)_rxFillIndicatorChangeMessage.GetFields()
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList();
		list.ResolveEvenRows();
		return list;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRecertificationMessage(string message)
	{
		List<ERxDataItemViewModel> viewModelsFromRecertificationMessage = GetViewModelsFromRecertificationMessage(null, message);
		viewModelsFromRecertificationMessage.ResolveEvenRows();
		return viewModelsFromRecertificationMessage;
	}

	public List<ERxDataItemViewModel> GetViewModelsFromRecertificationMessage(ERxRecertificationMessageData recertificationData, string message)
	{
		SetInternalMessage((ERxMessageTypes)14, message);
		FieldCollection fields = _recertificationMessage.GetFields();
		List<ERxDataItemViewModel> list = new List<ERxDataItemViewModel>();
		if (recertificationData != null && recertificationData.IsValid)
		{
			list.Add(new ERxDataItemViewModel
			{
				Title = "",
				Value = "FrameworkLTC Order Information",
				IsGroupHeader = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Facility",
				Value = recertificationData.FacName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Patient",
				Value = $"{recertificationData.PatName} ({recertificationData.PatID})",
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			string value = recertificationData.RoNo.ToString();
			list.Add(new ERxDataItemViewModel
			{
				Title = "Reorder #",
				Value = value,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
			list.Add(new ERxDataItemViewModel
			{
				Title = "Drug",
				Value = recertificationData.DrugName,
				IsGroupHeader = false,
				IsAlternatingBlue = true
			});
		}
		list.AddRange((from Field field in (IEnumerable)fields
			select new ERxDataItemViewModel
			{
				Value = field.Value,
				Title = field.Name,
				IsGroupHeader = (field.Style == "H"),
				IsGreen = (field.Style == "A"),
				IsRed = (field.Style == "D")
			}).ToList());
		list.ResolveEvenRows();
		return list;
	}

	public void Export(string path, List<ERxMessageDetails> items)
	{
		if (!items.Any())
		{
			return;
		}
		HashSet<string> hashSet = new HashSet<string>();
		foreach (ERxMessageDetails item in items)
		{
			foreach (ERxField field in item.Fields)
			{
				foreach (ERxField field2 in field.Fields)
				{
					if (!string.IsNullOrWhiteSpace(field2.Value))
					{
						hashSet.Add($"{field.Name} - {field2.Name}");
					}
				}
			}
		}
		List<string> list = hashSet.ToList();
		list.Sort();
		list.Insert(0, "ID");
		list.Insert(1, "Received Date");
		list.Insert(2, "From");
		list.Insert(3, "Interface");
		using StreamWriter streamWriter = new StreamWriter(path, append: false, Encoding.UTF8);
		streamWriter.WriteLine(string.Join(",", list.Select((string f) => StringExtensions.EscapeForCsv(f, false))));
		foreach (ERxMessageDetails item2 in items)
		{
			Dictionary<string, string> dictionary = new Dictionary<string, string>();
			foreach (ERxField field3 in item2.Fields)
			{
				foreach (ERxField field4 in field3.Fields)
				{
					if (!string.IsNullOrWhiteSpace(field4.Value))
					{
						string key = $"{field3.Name} - {field4.Name}";
						if (!dictionary.ContainsKey(key))
						{
							dictionary.Add(key, field4.Value);
						}
					}
				}
			}
			List<string> list2 = new List<string>();
			list2.Add(StringExtensions.EscapeForCsv(item2.Id.ToString(), false));
			list2.Add(StringExtensions.EscapeForCsv(item2.Received.ToString(), false));
			list2.Add(StringExtensions.EscapeForCsv(item2.From, false));
			list2.Add(StringExtensions.EscapeForCsv(item2.Interface, false));
			foreach (string item3 in list.Skip(4))
			{
				list2.Add((dictionary.ContainsKey(item3) && !string.IsNullOrEmpty(dictionary[item3])) ? StringExtensions.EscapeForCsv(dictionary[item3], false) : string.Empty);
			}
			streamWriter.WriteLine(string.Join(",", list2));
		}
		streamWriter.Flush();
	}

	public ERxMessageDataModel GetMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Unknown result type (might be due to invalid IL or missing references)
		//IL_004a: Expected I4, but got Unknown
		//IL_00cf: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d4: Unknown result type (might be due to invalid IL or missing references)
		//IL_00e5: Unknown result type (might be due to invalid IL or missing references)
		//IL_00f6: Unknown result type (might be due to invalid IL or missing references)
		//IL_0108: Expected Obj, but got Unknown
		//IL_024f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0254: Unknown result type (might be due to invalid IL or missing references)
		//IL_0265: Unknown result type (might be due to invalid IL or missing references)
		//IL_0276: Unknown result type (might be due to invalid IL or missing references)
		//IL_0288: Expected Obj, but got Unknown
		//IL_02cf: Unknown result type (might be due to invalid IL or missing references)
		//IL_02d4: Unknown result type (might be due to invalid IL or missing references)
		//IL_02e5: Unknown result type (might be due to invalid IL or missing references)
		//IL_02f6: Unknown result type (might be due to invalid IL or missing references)
		//IL_02fd: Unknown result type (might be due to invalid IL or missing references)
		//IL_0313: Unknown result type (might be due to invalid IL or missing references)
		//IL_0324: Unknown result type (might be due to invalid IL or missing references)
		//IL_033b: Expected Obj, but got Unknown
		//IL_004f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0054: Unknown result type (might be due to invalid IL or missing references)
		//IL_0065: Unknown result type (might be due to invalid IL or missing references)
		//IL_0076: Unknown result type (might be due to invalid IL or missing references)
		//IL_0088: Expected Obj, but got Unknown
		//IL_014f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0154: Unknown result type (might be due to invalid IL or missing references)
		//IL_0165: Unknown result type (might be due to invalid IL or missing references)
		//IL_0176: Unknown result type (might be due to invalid IL or missing references)
		//IL_0188: Expected Obj, but got Unknown
		//IL_01cf: Unknown result type (might be due to invalid IL or missing references)
		//IL_01d4: Unknown result type (might be due to invalid IL or missing references)
		//IL_01e5: Unknown result type (might be due to invalid IL or missing references)
		//IL_01f6: Unknown result type (might be due to invalid IL or missing references)
		//IL_0208: Expected Obj, but got Unknown
		//IL_0357: Unknown result type (might be due to invalid IL or missing references)
		//IL_035c: Unknown result type (might be due to invalid IL or missing references)
		//IL_036d: Unknown result type (might be due to invalid IL or missing references)
		//IL_037e: Unknown result type (might be due to invalid IL or missing references)
		//IL_038f: Unknown result type (might be due to invalid IL or missing references)
		//IL_03a1: Expected Obj, but got Unknown
		//IL_03c6: Unknown result type (might be due to invalid IL or missing references)
		//IL_03cb: Unknown result type (might be due to invalid IL or missing references)
		//IL_03dc: Unknown result type (might be due to invalid IL or missing references)
		//IL_03ed: Unknown result type (might be due to invalid IL or missing references)
		//IL_03ff: Expected Obj, but got Unknown
		ERxMessageDataModel val = null;
		SetInternalMessage(msgType, message);
		DateTime result;
		switch (msgType - 1)
		{
		case 4:
			val = new ERxMessageDataModel
			{
				FirstName = _newRxRequest.PatientFirstName,
				LastName = _newRxRequest.PatientLastName,
				SocialSecurityNumber = _newRxRequest.PatientSSN
			};
			if (DateTime.TryParse(_newRxRequest.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_newRxRequest.PatientGender);
			break;
		case 0:
			val = new ERxMessageDataModel
			{
				FirstName = _canRxRequest.PatientFirstName,
				LastName = _canRxRequest.PatientLastName,
				SocialSecurityNumber = _canRxRequest.PatientSSN
			};
			if (DateTime.TryParse(_canRxRequest.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_canRxRequest.PatientGender);
			break;
		case 6:
		case 9:
			val = new ERxMessageDataModel
			{
				FirstName = _refresMessage.PatientFirstName,
				LastName = _refresMessage.PatientLastName,
				SocialSecurityNumber = _refresMessage.PatientSSN
			};
			if (DateTime.TryParse(_refresMessage.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_refresMessage.PatientGender);
			break;
		case 7:
			val = new ERxMessageDataModel
			{
				FirstName = _resuppMessage.PatientFirstName,
				LastName = _resuppMessage.PatientLastName,
				SocialSecurityNumber = _resuppMessage.PatientSSN
			};
			if (DateTime.TryParse(_resuppMessage.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_resuppMessage.PatientGender);
			break;
		case 1:
			val = new ERxMessageDataModel
			{
				FirstName = _censusRequest.PatientFirstName,
				LastName = _censusRequest.PatientLastName,
				SocialSecurityNumber = _censusRequest.PatientSSN
			};
			if (DateTime.TryParse(_censusRequest.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_censusRequest.PatientGender);
			break;
		case 3:
			val = new ERxMessageDataModel
			{
				FirstName = _newOrder.PatFName,
				LastName = _newOrder.PatLName,
				SocialSecurityNumber = null,
				BirthDate = _newOrder.PatBirthdate,
				ExternalId = _newOrder.ExternalPatID,
				ExternalInterfaceId = _newOrder.ExternalInterfaceID
			};
			val.Gender = TranslateMsgGender(_newOrder.PatSex);
			break;
		case 11:
		{
			val = new ERxMessageDataModel
			{
				FirstName = _chgresMessage.PatientFirstName,
				LastName = _chgresMessage.PatientLastName,
				SocialSecurityNumber = _chgresMessage.PatientSSN,
				PrescriberOrderNumber = _chgresMessage.PrescriberOrderNumber
			};
			if (DateTime.TryParse(_chgresMessage.PatientDOB, out var result2))
			{
				val.BirthDate = result2;
			}
			break;
		}
		case 13:
			val = new ERxMessageDataModel
			{
				FirstName = _recertificationMessage.PatientFirstName,
				LastName = _recertificationMessage.PatientLastName,
				SocialSecurityNumber = _recertificationMessage.PatientSSN
			};
			if (DateTime.TryParse(_recertificationMessage.PatientDOB, new CultureInfo("en-US"), DateTimeStyles.None, out result))
			{
				val.BirthDate = result;
			}
			val.Gender = TranslateMsgGender(_recertificationMessage.PatientGender);
			break;
		}
		return val;
	}

	public string GetPatientFileId(ERxMessageTypes msgType, string message)
	{
		//IL_0007: Unknown result type (might be due to invalid IL or missing references)
		//IL_000e: Unknown result type (might be due to invalid IL or missing references)
		//IL_0010: Invalid comparison between Unknown and I4
		string result = "";
		SetInternalMessage(msgType, message);
		if ((int)msgType == 5)
		{
			result = _newRxRequest.PatientFileID;
		}
		return result;
	}

	public ERxHL7MessageData GetHL7RequestData(string message)
	{
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0020: Unknown result type (might be due to invalid IL or missing references)
		//IL_0031: Unknown result type (might be due to invalid IL or missing references)
		//IL_0042: Unknown result type (might be due to invalid IL or missing references)
		//IL_0053: Unknown result type (might be due to invalid IL or missing references)
		//IL_0064: Unknown result type (might be due to invalid IL or missing references)
		//IL_0075: Unknown result type (might be due to invalid IL or missing references)
		//IL_0086: Unknown result type (might be due to invalid IL or missing references)
		//IL_0097: Unknown result type (might be due to invalid IL or missing references)
		//IL_00a8: Unknown result type (might be due to invalid IL or missing references)
		//IL_00b9: Unknown result type (might be due to invalid IL or missing references)
		//IL_00de: Unknown result type (might be due to invalid IL or missing references)
		//IL_00ef: Unknown result type (might be due to invalid IL or missing references)
		//IL_0100: Unknown result type (might be due to invalid IL or missing references)
		//IL_0111: Unknown result type (might be due to invalid IL or missing references)
		//IL_0122: Unknown result type (might be due to invalid IL or missing references)
		//IL_0133: Unknown result type (might be due to invalid IL or missing references)
		//IL_0144: Unknown result type (might be due to invalid IL or missing references)
		//IL_0156: Expected Obj, but got Unknown
		//IL_0417: Unknown result type (might be due to invalid IL or missing references)
		//IL_0421: Expected Obj, but got Unknown
		//IL_01cf: Unknown result type (might be due to invalid IL or missing references)
		//IL_01d6: Expected Obj, but got Unknown
		//IL_01f0: Unknown result type (might be due to invalid IL or missing references)
		//IL_01f5: Unknown result type (might be due to invalid IL or missing references)
		//IL_0201: Unknown result type (might be due to invalid IL or missing references)
		//IL_020e: Unknown result type (might be due to invalid IL or missing references)
		//IL_021b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0228: Unknown result type (might be due to invalid IL or missing references)
		//IL_0235: Unknown result type (might be due to invalid IL or missing references)
		//IL_025a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0267: Unknown result type (might be due to invalid IL or missing references)
		//IL_028e: Unknown result type (might be due to invalid IL or missing references)
		//IL_029b: Unknown result type (might be due to invalid IL or missing references)
		//IL_02c2: Unknown result type (might be due to invalid IL or missing references)
		//IL_02d1: Expected Obj, but got Unknown
		ERxHL7MessageData val = null;
		SetInternalMessage((ERxMessageTypes)4, message);
		val = new ERxHL7MessageData
		{
			DrugName = _newOrder.DrugName,
			DrugID = _newOrder.DrugID,
			DrugIDType = _newOrder.DrugIDType,
			Strength = _newOrder.Strength,
			DosageForm = _newOrder.DosageForm,
			AllowSubstitutions = _newOrder.AllowSubstitutions,
			ExternalOrderNumber = _newOrder.ExternalOrderNumber,
			Comments = _newOrder.Comments,
			PhNPI = _newOrder.PrescriberNPI,
			Refills = _newOrder.Refills,
			DispenseDate = (_newOrder.DispenseDateProvided ? _newOrder.DispenseDate : DateTime.Today),
			CutoffDate = _newOrder.CutoffDate,
			CutoffDateProvided = _newOrder.CutoffDateProvided,
			Quantity = _newOrder.Quantity,
			ApplyQtyConversion = _newOrder.ApplyQtyConversion,
			Icd9Code = _newOrder.ICD9Code,
			Icd10Code = _newOrder.ICD10Code,
			Icd10Type = _newOrder.ICD10Type
		};
		val.StartDate = (_newOrder.StartDateProvided ? _newOrder.StartDate : val.DispenseDate);
		val.DaysSupply = 0m;
		val.ProfileOnly = false;
		if (((CollectionBase)(object)_newOrder.Splits).Count > 0)
		{
			bool flag = true;
			bool flag2 = false;
			foreach (Split item2 in (CollectionBase)(object)_newOrder.Splits)
			{
				Split val2 = item2;
				if (string.Equals(val2.Priority, "P"))
				{
					val.ProfileOnly = true;
				}
				ERxSplitInfo val3 = new ERxSplitInfo
				{
					AdminType = (SigCodeAdministrationType)0,
					Directions = val2.Directions,
					QtyPerDose = val2.QtyPerDose,
					UnitOfMeasureText = val2.UnitOfMeasureText,
					UnitOfMeasureID = val2.UnitOfMeasureID,
					RxType = (string.Equals(val2.Priority, "PRN") ? "P" : "C"),
					StartDateProvided = val2.StartDateProvided,
					StartDate = (val2.StartDateProvided ? new DateTime?(val2.StartDate) : ((DateTime?)null)),
					StopDateProvided = val2.StopDateProvided,
					StopDate = (val2.StopDateProvided ? new DateTime?(val2.StopDate) : ((DateTime?)null)),
					Conjunction = val2.Conjunction
				};
				if (!string.IsNullOrWhiteSpace(val2.AdminSchedule))
				{
					ParseAdminSched(val3, val2.AdminSchedule);
				}
				if (flag)
				{
					val.DaysSupply = val2.DaysSupply;
					if (string.Equals(val2.Conjunction, "S"))
					{
						flag2 = true;
					}
				}
				else if (flag2)
				{
					ERxHL7MessageData val4 = val;
					val4.DaysSupply += (decimal?)val2.DaysSupply;
				}
				else
				{
					decimal daysSupply = val2.DaysSupply;
					decimal? daysSupply2 = val.DaysSupply;
					if ((daysSupply > daysSupply2.GetValueOrDefault()) & daysSupply2.HasValue)
					{
						val.DaysSupply = val2.DaysSupply;
					}
				}
				foreach (string item3 in (CollectionBase)(object)val2.AdminTimes)
				{
					val3.AdminTimes.Add(item3);
				}
				val.Splits.Add(val3);
				flag = false;
			}
		}
		else
		{
			val.Splits.Add(new ERxSplitInfo());
		}
		DetermineTimesPerDay(val);
		return val;
	}

	public ERxCensusMessageData GetCensusRequestData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Invalid comparison between Unknown and I4
		//IL_0022: Unknown result type (might be due to invalid IL or missing references)
		//IL_0027: Unknown result type (might be due to invalid IL or missing references)
		//IL_0038: Unknown result type (might be due to invalid IL or missing references)
		//IL_003b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0045: Unknown result type (might be due to invalid IL or missing references)
		//IL_0056: Unknown result type (might be due to invalid IL or missing references)
		//IL_0067: Unknown result type (might be due to invalid IL or missing references)
		//IL_0078: Unknown result type (might be due to invalid IL or missing references)
		//IL_0089: Unknown result type (might be due to invalid IL or missing references)
		//IL_009a: Unknown result type (might be due to invalid IL or missing references)
		//IL_00ab: Unknown result type (might be due to invalid IL or missing references)
		//IL_00bc: Unknown result type (might be due to invalid IL or missing references)
		//IL_00cd: Unknown result type (might be due to invalid IL or missing references)
		//IL_00de: Unknown result type (might be due to invalid IL or missing references)
		//IL_00ef: Unknown result type (might be due to invalid IL or missing references)
		//IL_0100: Unknown result type (might be due to invalid IL or missing references)
		//IL_0111: Unknown result type (might be due to invalid IL or missing references)
		//IL_0122: Unknown result type (might be due to invalid IL or missing references)
		//IL_0133: Unknown result type (might be due to invalid IL or missing references)
		//IL_0144: Unknown result type (might be due to invalid IL or missing references)
		//IL_0155: Unknown result type (might be due to invalid IL or missing references)
		//IL_0166: Unknown result type (might be due to invalid IL or missing references)
		//IL_0177: Unknown result type (might be due to invalid IL or missing references)
		//IL_0188: Unknown result type (might be due to invalid IL or missing references)
		//IL_0199: Unknown result type (might be due to invalid IL or missing references)
		//IL_01aa: Unknown result type (might be due to invalid IL or missing references)
		//IL_01c0: Expected Obj, but got Unknown
		//IL_01dd: Unknown result type (might be due to invalid IL or missing references)
		//IL_01e3: Expected Obj, but got Unknown
		//IL_01e9: Unknown result type (might be due to invalid IL or missing references)
		//IL_01ee: Unknown result type (might be due to invalid IL or missing references)
		//IL_01fa: Unknown result type (might be due to invalid IL or missing references)
		//IL_0206: Unknown result type (might be due to invalid IL or missing references)
		//IL_0212: Unknown result type (might be due to invalid IL or missing references)
		//IL_021e: Unknown result type (might be due to invalid IL or missing references)
		//IL_022a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0236: Unknown result type (might be due to invalid IL or missing references)
		//IL_0242: Unknown result type (might be due to invalid IL or missing references)
		//IL_024e: Unknown result type (might be due to invalid IL or missing references)
		//IL_025a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0266: Unknown result type (might be due to invalid IL or missing references)
		//IL_0272: Unknown result type (might be due to invalid IL or missing references)
		//IL_027e: Unknown result type (might be due to invalid IL or missing references)
		//IL_028a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0296: Unknown result type (might be due to invalid IL or missing references)
		//IL_02a2: Unknown result type (might be due to invalid IL or missing references)
		//IL_02b3: Expected Obj, but got Unknown
		//IL_02f0: Unknown result type (might be due to invalid IL or missing references)
		//IL_02f7: Expected Obj, but got Unknown
		//IL_02fd: Unknown result type (might be due to invalid IL or missing references)
		//IL_0302: Unknown result type (might be due to invalid IL or missing references)
		//IL_030f: Unknown result type (might be due to invalid IL or missing references)
		//IL_031c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0329: Unknown result type (might be due to invalid IL or missing references)
		//IL_0336: Unknown result type (might be due to invalid IL or missing references)
		//IL_0343: Unknown result type (might be due to invalid IL or missing references)
		//IL_0350: Unknown result type (might be due to invalid IL or missing references)
		//IL_035d: Unknown result type (might be due to invalid IL or missing references)
		//IL_036a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0377: Unknown result type (might be due to invalid IL or missing references)
		//IL_0384: Unknown result type (might be due to invalid IL or missing references)
		//IL_0391: Unknown result type (might be due to invalid IL or missing references)
		//IL_039e: Unknown result type (might be due to invalid IL or missing references)
		//IL_03b0: Expected Obj, but got Unknown
		//IL_03ed: Unknown result type (might be due to invalid IL or missing references)
		//IL_03f4: Expected Obj, but got Unknown
		//IL_03f4: Unknown result type (might be due to invalid IL or missing references)
		//IL_03f9: Unknown result type (might be due to invalid IL or missing references)
		//IL_0406: Unknown result type (might be due to invalid IL or missing references)
		//IL_0413: Unknown result type (might be due to invalid IL or missing references)
		//IL_0420: Unknown result type (might be due to invalid IL or missing references)
		//IL_042d: Unknown result type (might be due to invalid IL or missing references)
		//IL_043c: Expected Obj, but got Unknown
		//IL_0453: Unknown result type (might be due to invalid IL or missing references)
		//IL_045a: Expected Obj, but got Unknown
		//IL_0461: Unknown result type (might be due to invalid IL or missing references)
		//IL_0466: Unknown result type (might be due to invalid IL or missing references)
		//IL_0473: Unknown result type (might be due to invalid IL or missing references)
		//IL_0480: Unknown result type (might be due to invalid IL or missing references)
		//IL_0492: Expected Obj, but got Unknown
		ERxCensusMessageData val = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 2)
		{
			ERxCensusRequestTypeEnum? byDatabaseValue = EnumExtensions.GetByDatabaseValue<ERxCensusRequestTypeEnum?>(_censusRequest.RequestType);
			val = StringExtensions.TruncateFieldsToMaximumLength<ERxCensusMessageData>(new ERxCensusMessageData
			{
				RequestTypeAsString = _censusRequest.RequestType,
				RequestType = byDatabaseValue.GetValueOrDefault(),
				FacilityNPI = _censusRequest.FacilityNPI,
				FacilityFileID = _censusRequest.FacilityFileID,
				FacilitySPI = _censusRequest.FacilitySPI,
				PatientLastName = _censusRequest.PatientLastName,
				PatientFirstName = _censusRequest.PatientFirstName,
				PatientMiddleInitial = _censusRequest.PatientMiddleName,
				PatientGender = _censusRequest.PatientGender,
				PatientDOB = _censusRequest.PatientDOB,
				CensusEffectiveDate = _censusRequest.CensusEffectiveDate,
				PatientFacilityUnit = _censusRequest.PatientFacilityUnit,
				PatientRoom = _censusRequest.PatientRoom,
				PatientBed = _censusRequest.PatientBed,
				PatientSSN = _censusRequest.PatientSSN,
				PatientMedicalRecordNumber = _censusRequest.PatientMedicalRecordNumber,
				PatientMedicareNo = _censusRequest.PatientMedicareNo,
				PatientAddress1 = _censusRequest.PatientAddress1,
				PatientAddress2 = _censusRequest.PatientAddress2,
				PatientCity = _censusRequest.PatientCity,
				PatientState = _censusRequest.PatientState,
				PatientZip = _censusRequest.PatientZip,
				PatientPhone = _censusRequest.PatientPhone,
				PrescriberNPI = _censusRequest.PrescriberNPI
			});
			foreach (PaymentMethod item in (CollectionBase)(object)_censusRequest.PaymentMethods)
			{
				PaymentMethod val2 = item;
				val.PaymentMethods.Add(new PaymentMethod
				{
					PayerName = val2.PayerName,
					PayerID = val2.PayerID,
					Bin = val2.Bin,
					ProcCtlNo = val2.ProcCtlNo,
					Type = val2.Type,
					CardholderID = val2.CardholderID,
					RPFullName = val2.RPFullName,
					RPAddressLine1 = val2.RPAddressLine1,
					RPAddressLine2 = val2.RPAddressLine2,
					RPCity = val2.RPCity,
					RPState = val2.RPState,
					RPZipCode = val2.RPZipCode,
					RPPhone1 = val2.RPPhone1,
					RPPhone2 = val2.RPPhone2,
					GroupID = val2.GroupID,
					GroupName = val2.GroupName
				});
			}
			foreach (Allergy item2 in (CollectionBase)(object)_censusRequest.Allergies)
			{
				Allergy val3 = item2;
				val.Allergies.Add(new Allergy
				{
					NoKnownAllergies = val3.NoKnownAllergies,
					SourceOfInformation = val3.SourceOfInformation,
					EffectiveDate = val3.EffectiveDate,
					ExpirationDate = val3.ExpirationDate,
					AdverseEventItemNumber = val3.AdverseEventItemNumber,
					AdverseEventDescription = val3.AdverseEventDescription,
					DrugItemNumberType = val3.DrugItemNumberType,
					DrugItemNumber = val3.DrugItemNumber,
					DrugDescription = val3.DrugDescription,
					ReactionItemNumber = val3.ReactionItemNumber,
					ReactionDescription = val3.ReactionDescription,
					SeverityItemNumber = val3.SeverityItemNumber,
					SeverityDescription = val3.SeverityDescription
				});
			}
			foreach (MedicalCondition item3 in (CollectionBase)(object)_censusRequest.MedicalConditions)
			{
				MedicalCondition val4 = item3;
				MedicalCondition val5 = new MedicalCondition
				{
					SourceOfInformation = val4.SourceOfInformation,
					EffectiveDate = val4.EffectiveDate,
					ExpirationDate = val4.ExpirationDate,
					ProblemTypeItemNumber = val4.ProblemTypeItemNumber,
					ProblemTypeDescription = val4.ProblemTypeDescription
				};
				foreach (MedicalConditionProblem item4 in (CollectionBase)(object)val4.ProblemNames)
				{
					MedicalConditionProblem val6 = item4;
					val5.ProblemNames.Add(new MedicalConditionProblem
					{
						Description = val6.Description,
						ItemNumber = val6.ItemNumber,
						CodeListQualifier = val6.CodeListQualifier
					});
				}
				val.MedicalConditions.Add(val5);
			}
		}
		return val;
	}

	public ERxNewRxRequestMessageData GetERxNewRxRequestMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Invalid comparison between Unknown and I4
		//IL_0011: Unknown result type (might be due to invalid IL or missing references)
		//IL_0016: Unknown result type (might be due to invalid IL or missing references)
		//IL_0027: Unknown result type (might be due to invalid IL or missing references)
		//IL_0038: Unknown result type (might be due to invalid IL or missing references)
		//IL_0049: Unknown result type (might be due to invalid IL or missing references)
		//IL_005a: Unknown result type (might be due to invalid IL or missing references)
		//IL_006b: Unknown result type (might be due to invalid IL or missing references)
		//IL_007c: Unknown result type (might be due to invalid IL or missing references)
		//IL_008d: Unknown result type (might be due to invalid IL or missing references)
		//IL_009e: Unknown result type (might be due to invalid IL or missing references)
		//IL_00af: Unknown result type (might be due to invalid IL or missing references)
		//IL_00c0: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d1: Unknown result type (might be due to invalid IL or missing references)
		//IL_00e2: Unknown result type (might be due to invalid IL or missing references)
		//IL_00f3: Unknown result type (might be due to invalid IL or missing references)
		//IL_0104: Unknown result type (might be due to invalid IL or missing references)
		//IL_0115: Unknown result type (might be due to invalid IL or missing references)
		//IL_0126: Unknown result type (might be due to invalid IL or missing references)
		//IL_0137: Unknown result type (might be due to invalid IL or missing references)
		//IL_0148: Unknown result type (might be due to invalid IL or missing references)
		//IL_0159: Unknown result type (might be due to invalid IL or missing references)
		//IL_016a: Unknown result type (might be due to invalid IL or missing references)
		//IL_017b: Unknown result type (might be due to invalid IL or missing references)
		//IL_018c: Unknown result type (might be due to invalid IL or missing references)
		//IL_019d: Unknown result type (might be due to invalid IL or missing references)
		//IL_01ae: Unknown result type (might be due to invalid IL or missing references)
		//IL_01bf: Unknown result type (might be due to invalid IL or missing references)
		//IL_01d0: Unknown result type (might be due to invalid IL or missing references)
		//IL_01e1: Unknown result type (might be due to invalid IL or missing references)
		//IL_01f2: Unknown result type (might be due to invalid IL or missing references)
		//IL_0203: Unknown result type (might be due to invalid IL or missing references)
		//IL_0214: Unknown result type (might be due to invalid IL or missing references)
		//IL_0225: Unknown result type (might be due to invalid IL or missing references)
		//IL_0236: Unknown result type (might be due to invalid IL or missing references)
		//IL_0247: Unknown result type (might be due to invalid IL or missing references)
		//IL_0258: Unknown result type (might be due to invalid IL or missing references)
		//IL_0269: Unknown result type (might be due to invalid IL or missing references)
		//IL_027a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0292: Expected Obj, but got Unknown
		ERxNewRxRequestMessageData result = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 5)
		{
			result = new ERxNewRxRequestMessageData
			{
				IsACompound = _newRxRequest.IsACompound,
				NDC = _newRxRequest.NDC,
				DrugName = _newRxRequest.DrugName,
				Strength = _newRxRequest.Strength,
				GPI = _newRxRequest.GPI,
				DAW = _newRxRequest.DAW,
				PhNPI = _newRxRequest.PrescriberNPI,
				SPI = _newRxRequest.PrescriberSPI,
				MsgSig = _newRxRequest.Directions,
				Days = _newRxRequest.DaysSupply,
				Qty = _newRxRequest.Quantity,
				QuantityQualifier = _newRxRequest.QuantityQualifier,
				ProfileOnly = _newRxRequest.ProfileOnly,
				AssocDxType = _newRxRequest.AssocDxType,
				AssocDx = _newRxRequest.AssocDx,
				DateWritten = _newRxRequest.DateWritten,
				StartDate = _newRxRequest.StartDate,
				StopDate = _newRxRequest.PeriodEnd,
				EffectiveDate = _newRxRequest.EffectiveDate,
				Refills = _newRxRequest.Refills,
				PrescriberOrderNumber = _newRxRequest.PrescriberOrderNumber,
				PrescriberLastName = _newRxRequest.PrescriberLastName,
				PrescriberFirstName = _newRxRequest.PrescriberFirstName,
				PrescriberStreetAddress = _newRxRequest.PrescriberStreetAddress,
				PrescriberCity = _newRxRequest.PrescriberCity,
				PrescriberState = _newRxRequest.PrescriberState,
				PrescriberZip = _newRxRequest.PrescriberZip,
				PrescriberDEA = _newRxRequest.PrescriberDEA,
				PrescriberStateLicenseNo = _newRxRequest.PrescriberStateLicenseNo,
				PrescriberPhone = _newRxRequest.PrescriberPhone,
				PrescriberFax = _newRxRequest.PrescriberFax,
				PrescriberEmail = _newRxRequest.PrescriberEmail,
				PrescriberAgentName = _newRxRequest.PrescriberAgentName,
				Notes = _newRxRequest.Notes,
				RxFillIndicator = _newRxRequest.RxFillIndicator,
				ProhibitRenewalRequest = _newRxRequest.ProhibitRenewalRequest,
				RxAdminTimes = ParseFacilityAdminTimes(_newRxRequest.FacilitySpecificHoursOfAdministration)
			};
		}
		return result;
	}

	public ERxCancelMessageData GetCancelMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Invalid comparison between Unknown and I4
		//IL_0011: Unknown result type (might be due to invalid IL or missing references)
		//IL_0016: Unknown result type (might be due to invalid IL or missing references)
		//IL_0027: Unknown result type (might be due to invalid IL or missing references)
		//IL_0038: Unknown result type (might be due to invalid IL or missing references)
		//IL_0049: Unknown result type (might be due to invalid IL or missing references)
		//IL_005a: Unknown result type (might be due to invalid IL or missing references)
		//IL_006b: Unknown result type (might be due to invalid IL or missing references)
		//IL_007c: Unknown result type (might be due to invalid IL or missing references)
		//IL_008d: Unknown result type (might be due to invalid IL or missing references)
		//IL_009e: Unknown result type (might be due to invalid IL or missing references)
		//IL_00af: Unknown result type (might be due to invalid IL or missing references)
		//IL_00c0: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d1: Unknown result type (might be due to invalid IL or missing references)
		//IL_00e2: Unknown result type (might be due to invalid IL or missing references)
		//IL_00f3: Unknown result type (might be due to invalid IL or missing references)
		//IL_0104: Unknown result type (might be due to invalid IL or missing references)
		//IL_0116: Expected Obj, but got Unknown
		ERxCancelMessageData result = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 1)
		{
			result = new ERxCancelMessageData
			{
				CancelType = _canRxRequest.CancelType,
				NDC = _canRxRequest.NDC,
				PrescriberOrderNumber = _canRxRequest.PrescriberOrderNumber,
				RxReferenceNumber = _canRxRequest.RxReferenceNumber,
				RelatedMsgID = _canRxRequest.RelatedMessageID,
				ExpirationDate = _canRxRequest.ExpirationDate,
				ExpirationDateFormat = _canRxRequest.ExpirationDateFormat,
				PeriodEnd = _canRxRequest.PeriodEnd,
				PeriodEndFormat = _canRxRequest.PeriodEndFormat,
				MessageDate = _canRxRequest.MessageDate,
				CutoffDate = _canRxRequest.CutoffDate,
				CutoffDateFormat = _canRxRequest.CutoffDateFormat,
				RxFillIndicator = _canRxRequest.RxFillIndicator,
				ProhibitRenewalRequest = _canRxRequest.ProhibitRenewalRequest,
				PrescriberAgentName = _canRxRequest.PrescriberAgentName
			};
		}
		return result;
	}

	public ERxRefillResponseMessageData GetRefillResponseMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Invalid comparison between Unknown and I4
		//IL_000e: Unknown result type (might be due to invalid IL or missing references)
		//IL_0011: Invalid comparison between Unknown and I4
		//IL_00c2: Unknown result type (might be due to invalid IL or missing references)
		//IL_00c7: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d8: Unknown result type (might be due to invalid IL or missing references)
		//IL_00e9: Unknown result type (might be due to invalid IL or missing references)
		//IL_00fa: Unknown result type (might be due to invalid IL or missing references)
		//IL_010b: Unknown result type (might be due to invalid IL or missing references)
		//IL_011c: Unknown result type (might be due to invalid IL or missing references)
		//IL_012d: Unknown result type (might be due to invalid IL or missing references)
		//IL_013e: Unknown result type (might be due to invalid IL or missing references)
		//IL_014f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0160: Unknown result type (might be due to invalid IL or missing references)
		//IL_0171: Unknown result type (might be due to invalid IL or missing references)
		//IL_0178: Unknown result type (might be due to invalid IL or missing references)
		//IL_0180: Unknown result type (might be due to invalid IL or missing references)
		//IL_0191: Unknown result type (might be due to invalid IL or missing references)
		//IL_01a2: Unknown result type (might be due to invalid IL or missing references)
		//IL_01aa: Expected Obj, but got Unknown
		ERxRefillResponseMessageData val = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 7 || (int)msgType == 10)
		{
			DateTime? startDate = null;
			if (!string.IsNullOrWhiteSpace(_refresMessage.StartDate) && DateTime.TryParse(_refresMessage.StartDate, out var result))
			{
				startDate = result;
			}
			DateTime? effectiveDate = null;
			if (!string.IsNullOrWhiteSpace(_refresMessage.EffectiveDate) && DateTime.TryParse(_refresMessage.EffectiveDate, out var result2))
			{
				effectiveDate = result2;
			}
			bool isApproved = string.Equals(_refresMessage.ResponseStatusCode, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)0), StringComparison.OrdinalIgnoreCase) || string.Equals(_refresMessage.ResponseStatusCode, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)1), StringComparison.OrdinalIgnoreCase);
			val = new ERxRefillResponseMessageData
			{
				MessageReferenceNumber = _refresMessage.MessageReferenceNumber,
				ResponseStatusCode = _refresMessage.ResponseStatusCode,
				RefillsAuthorizedProvided = _refresMessage.RefillsAuthorizedProvided,
				DateWritten = _refresMessage.DateWritten,
				DAW = _refresMessage.DAW,
				RefillsAuthorized = _refresMessage.RefillsAuthorized,
				PrescriberOrderNumber = _refresMessage.PrescriberOrderNumber,
				PrescriberNPI = _refresMessage.PrescriberNPI,
				RequestId = _refresMessage.RequestID,
				RxFillIndicator = _refresMessage.RxFillIndicator,
				StartDate = startDate,
				IsApproved = isApproved,
				Qty = _refresMessage.Quantity,
				Days = _refresMessage.DaysSupply,
				EffectiveDate = effectiveDate
			};
			if (string.Equals(_refresMessage.ResponseStatusCode, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)2)) || string.Equals(_refresMessage.ResponseStatusCode, EnumExtensions.GetDatabaseValue((Enum)(object)(ERxResponseStatusCode)3)))
			{
				val.ResponseMessage = _refresMessage.ResponseMessage;
				val.ResponseFreeText = _refresMessage.ResponseFreeText;
			}
		}
		return val;
	}

	public ERxNewRxRequestMessageData GetNewRxMessageDataFromRenewalResponse(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000d: Invalid comparison between Unknown and I4
		//IL_0012: Unknown result type (might be due to invalid IL or missing references)
		//IL_0017: Unknown result type (might be due to invalid IL or missing references)
		//IL_0028: Unknown result type (might be due to invalid IL or missing references)
		//IL_0039: Unknown result type (might be due to invalid IL or missing references)
		//IL_004a: Unknown result type (might be due to invalid IL or missing references)
		//IL_005b: Unknown result type (might be due to invalid IL or missing references)
		//IL_006c: Unknown result type (might be due to invalid IL or missing references)
		//IL_007d: Unknown result type (might be due to invalid IL or missing references)
		//IL_008e: Unknown result type (might be due to invalid IL or missing references)
		//IL_009f: Unknown result type (might be due to invalid IL or missing references)
		//IL_00b0: Unknown result type (might be due to invalid IL or missing references)
		//IL_00c1: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d2: Unknown result type (might be due to invalid IL or missing references)
		//IL_00d9: Unknown result type (might be due to invalid IL or missing references)
		//IL_00ea: Unknown result type (might be due to invalid IL or missing references)
		//IL_00fb: Unknown result type (might be due to invalid IL or missing references)
		//IL_010c: Unknown result type (might be due to invalid IL or missing references)
		//IL_011d: Unknown result type (might be due to invalid IL or missing references)
		//IL_012e: Unknown result type (might be due to invalid IL or missing references)
		//IL_013f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0158: Unknown result type (might be due to invalid IL or missing references)
		//IL_0169: Unknown result type (might be due to invalid IL or missing references)
		//IL_017a: Unknown result type (might be due to invalid IL or missing references)
		//IL_018b: Unknown result type (might be due to invalid IL or missing references)
		//IL_019c: Unknown result type (might be due to invalid IL or missing references)
		//IL_01ad: Unknown result type (might be due to invalid IL or missing references)
		//IL_01be: Unknown result type (might be due to invalid IL or missing references)
		//IL_01cf: Unknown result type (might be due to invalid IL or missing references)
		//IL_01e0: Unknown result type (might be due to invalid IL or missing references)
		//IL_01f1: Unknown result type (might be due to invalid IL or missing references)
		//IL_0202: Unknown result type (might be due to invalid IL or missing references)
		//IL_0213: Unknown result type (might be due to invalid IL or missing references)
		//IL_0224: Unknown result type (might be due to invalid IL or missing references)
		//IL_0235: Unknown result type (might be due to invalid IL or missing references)
		//IL_0247: Expected Obj, but got Unknown
		ERxNewRxRequestMessageData result = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 10)
		{
			result = new ERxNewRxRequestMessageData
			{
				IsACompound = _refresMessage.IsACompound,
				NDC = _refresMessage.NDC,
				DrugName = _refresMessage.DrugName,
				Strength = _refresMessage.Strength,
				GPI = _refresMessage.GPI,
				DAW = _refresMessage.DAW,
				PhNPI = _refresMessage.PrescriberNPI,
				SPI = _refresMessage.PrescriberSPI,
				MsgSig = _refresMessage.Directions,
				Days = _refresMessage.DaysSupply,
				Qty = _refresMessage.Quantity,
				ProfileOnly = false,
				AssocDxType = _refresMessage.AssocDxType,
				AssocDx = _refresMessage.AssocDx,
				DateWritten = _refresMessage.DateWritten,
				StartDate = _refresMessage.StartDate,
				StopDate = _refresMessage.PeriodEnd,
				EffectiveDate = _refresMessage.EffectiveDate,
				Refills = Math.Max(_refresMessage.RefillsAuthorized - 1, 0),
				PrescriberOrderNumber = _refresMessage.PrescriberOrderNumber,
				PrescriberLastName = _refresMessage.PrescriberLastName,
				PrescriberFirstName = _refresMessage.PrescriberFirstName,
				PrescriberStreetAddress = _refresMessage.PrescriberStreetAddress,
				PrescriberCity = _refresMessage.PrescriberCity,
				PrescriberState = _refresMessage.PrescriberState,
				PrescriberZip = _refresMessage.PrescriberZip,
				PrescriberDEA = _refresMessage.PrescriberDEA,
				PrescriberStateLicenseNo = _refresMessage.PrescriberStateLicenseNo,
				PrescriberPhone = _refresMessage.PrescriberPhone,
				PrescriberFax = _refresMessage.PrescriberFax,
				PrescriberEmail = _refresMessage.PrescriberEmail,
				Notes = _refresMessage.Notes,
				RxFillIndicator = _refresMessage.RxFillIndicator
			};
		}
		return result;
	}

	public ERxResupplyMessageData GetResupplyMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Invalid comparison between Unknown and I4
		//IL_0011: Unknown result type (might be due to invalid IL or missing references)
		//IL_0016: Unknown result type (might be due to invalid IL or missing references)
		//IL_0027: Unknown result type (might be due to invalid IL or missing references)
		//IL_0038: Unknown result type (might be due to invalid IL or missing references)
		//IL_0049: Unknown result type (might be due to invalid IL or missing references)
		//IL_005a: Unknown result type (might be due to invalid IL or missing references)
		//IL_006b: Unknown result type (might be due to invalid IL or missing references)
		//IL_007c: Unknown result type (might be due to invalid IL or missing references)
		//IL_008d: Unknown result type (might be due to invalid IL or missing references)
		//IL_009f: Expected Obj, but got Unknown
		ERxResupplyMessageData result = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 8)
		{
			result = new ERxResupplyMessageData
			{
				PrescriberOrderNumber = _resuppMessage.PrescriberOrderNumber,
				RxReferenceNumber = _resuppMessage.RxReferenceNumber,
				NDC = _resuppMessage.NDC,
				DateValidated = _resuppMessage.DateValidated,
				RxFillIndicator = _resuppMessage.RxFillIndicator,
				ProhibitRenewalRequest = _resuppMessage.ProhibitRenewalRequest,
				PhysicianNPI = _resuppMessage.PrescriberNPI,
				PrescriberSPI = _resuppMessage.PrescriberSPI
			};
		}
		return result;
	}

	public ERxRxFillIndicatorChangeMessageData GetRxFillIndicatorChangeMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000d: Invalid comparison between Unknown and I4
		//IL_000f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0014: Unknown result type (might be due to invalid IL or missing references)
		//IL_0025: Unknown result type (might be due to invalid IL or missing references)
		//IL_0036: Unknown result type (might be due to invalid IL or missing references)
		//IL_0047: Unknown result type (might be due to invalid IL or missing references)
		//IL_0059: Expected Obj, but got Unknown
		ERxRxFillIndicatorChangeMessageData result = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 13)
		{
			result = new ERxRxFillIndicatorChangeMessageData
			{
				PrescriberOrderNumber = _rxFillIndicatorChangeMessage.PrescriberOrderNumber,
				ReturnReceipt = _rxFillIndicatorChangeMessage.ReturnReceipt,
				RxFillIndicator = _rxFillIndicatorChangeMessage.RxFillIndicator,
				RelatedMsgID = _rxFillIndicatorChangeMessage.RelatedMessageID
			};
		}
		return result;
	}

	public ERxRecertificationMessageData GetRecertificationMessageData(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_000a: Unknown result type (might be due to invalid IL or missing references)
		//IL_000d: Invalid comparison between Unknown and I4
		//IL_0012: Unknown result type (might be due to invalid IL or missing references)
		//IL_0017: Unknown result type (might be due to invalid IL or missing references)
		//IL_0028: Unknown result type (might be due to invalid IL or missing references)
		//IL_0039: Unknown result type (might be due to invalid IL or missing references)
		//IL_004a: Unknown result type (might be due to invalid IL or missing references)
		//IL_005b: Unknown result type (might be due to invalid IL or missing references)
		//IL_006c: Unknown result type (might be due to invalid IL or missing references)
		//IL_007d: Unknown result type (might be due to invalid IL or missing references)
		//IL_008f: Expected Obj, but got Unknown
		ERxRecertificationMessageData val = null;
		SetInternalMessage(msgType, message);
		if ((int)msgType == 14)
		{
			val = new ERxRecertificationMessageData
			{
				PrescriberOrderNumber = _recertificationMessage.PrescriberOrderNumber,
				RxReferenceNumber = _recertificationMessage.RxReferenceNumber,
				RelatedMsgID = _recertificationMessage.RequestID,
				NDC = _recertificationMessage.NDC,
				RxFillIndicator = _recertificationMessage.RxFillIndicator,
				PhysicianNPI = _recertificationMessage.PrescriberNPI,
				PrescriberSPI = _recertificationMessage.PrescriberSPI
			};
			if (DateTime.TryParse(_recertificationMessage.DateRecertified, out var result))
			{
				val.DateRecertified = result;
			}
		}
		return val;
	}

	public string GetHL7RxMessageFacility(ERxMessageTypes msgType, string message)
	{
		//IL_0007: Unknown result type (might be due to invalid IL or missing references)
		//IL_000e: Unknown result type (might be due to invalid IL or missing references)
		//IL_0010: Invalid comparison between Unknown and I4
		string result = "";
		SetInternalMessage(msgType, message);
		if ((int)msgType == 4)
		{
			result = _newOrder.FacID;
		}
		return result;
	}

	public ERxTranslateStructuredSigRequestModel GetStructuredSigRequestModels(ERxMessageTypes msgType, string message)
	{
		//IL_0000: Unknown result type (might be due to invalid IL or missing references)
		//IL_0006: Expected Obj, but got Unknown
		//IL_0012: Unknown result type (might be due to invalid IL or missing references)
		//IL_0019: Unknown result type (might be due to invalid IL or missing references)
		//IL_001b: Invalid comparison between Unknown and I4
		//IL_004c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0052: Expected Obj, but got Unknown
		//IL_0052: Unknown result type (might be due to invalid IL or missing references)
		//IL_0058: Expected Obj, but got Unknown
		ERxTranslateStructuredSigRequestModel val = new ERxTranslateStructuredSigRequestModel();
		val.SigList = new List<StructuredSig>();
		SetInternalMessage(msgType, message);
		if ((int)msgType == 5 && _newRxRequest.StructuredSigs != null)
		{
			foreach (StructuredSig item in (CollectionBase)(object)_newRxRequest.StructuredSigs)
			{
				StructuredSig val2 = item;
				StructuredSig val3 = new StructuredSig();
				val3.SigFreeText = val2.SigFreeText;
				val3.MultipleSigModifier = val2.MultipleSigModifier;
				val3.DoseDeliveryMethodCode = val2.DoseDeliveryMethodCode;
				val3.DoseQuantity = val2.DoseQuantity;
				val3.DoseFormCode = val2.DoseFormCode;
				val3.DoseDeliveryMethodText = val2.DoseDeliveryMethodText;
				val3.DoseFormText = val2.DoseFormText;
				val3.RouteOfAdministrationCode = val2.RouteOfAdministrationCode;
				val3.RouteOfAdministrationText = val2.RouteOfAdministrationText;
				val3.AdministrationTimingCode = val2.AdministrationTimingCode;
				val3.AdministrationTimingText = val2.AdministrationTimingText;
				val3.FrequencyUnitsCode = val2.FrequencyUnitsCode;
				val3.FrequencyNumericValue = val2.FrequencyNumericValue;
				val3.FrequencyUnitsText = val2.FrequencyUnitsText;
				val3.IntervalUnitsCode = val2.IntervalUnitsCode;
				val3.IntervalNumericValue = val2.IntervalNumericValue;
				val3.IntervalUnitsText = val2.IntervalUnitsText;
				val3.IndicationPrecursorCode = val2.IndicationPrecursorCode;
				val3.IndicationText = val2.IndicationText;
				val3.IndicationPrecursorText = val2.IndicationPrecursorText;
				val3.DurationTextCode = val2.DurationTextCode;
				val3.DurationNumericValue = val2.DurationNumericValue;
				val3.DurationText = val2.DurationText;
				val.SigList.Add(val3);
			}
		}
		return val;
	}

	private void SetInternalMessage(ERxMessageTypes msgType, string message)
	{
		//IL_0003: Unknown result type (might be due to invalid IL or missing references)
		//IL_0008: Unknown result type (might be due to invalid IL or missing references)
		//IL_010c: Unknown result type (might be due to invalid IL or missing references)
		//IL_014e: Expected I4, but got Unknown
		//IL_001f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0061: Expected I4, but got Unknown
		//IL_02c5: Unknown result type (might be due to invalid IL or missing references)
		//IL_02ca: Unknown result type (might be due to invalid IL or missing references)
		//IL_02d6: Expected Obj, but got Unknown
		//IL_0177: Unknown result type (might be due to invalid IL or missing references)
		//IL_017c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0188: Unknown result type (might be due to invalid IL or missing references)
		//IL_0194: Expected Obj, but got Unknown
		//IL_0203: Unknown result type (might be due to invalid IL or missing references)
		//IL_0208: Unknown result type (might be due to invalid IL or missing references)
		//IL_0214: Unknown result type (might be due to invalid IL or missing references)
		//IL_0220: Expected Obj, but got Unknown
		//IL_028c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0291: Unknown result type (might be due to invalid IL or missing references)
		//IL_029d: Expected Obj, but got Unknown
		//IL_02a0: Unknown result type (might be due to invalid IL or missing references)
		//IL_02a5: Unknown result type (might be due to invalid IL or missing references)
		//IL_02b6: Expected Obj, but got Unknown
		//IL_0154: Unknown result type (might be due to invalid IL or missing references)
		//IL_0159: Unknown result type (might be due to invalid IL or missing references)
		//IL_0165: Unknown result type (might be due to invalid IL or missing references)
		//IL_0171: Expected Obj, but got Unknown
		//IL_01bd: Unknown result type (might be due to invalid IL or missing references)
		//IL_01c2: Unknown result type (might be due to invalid IL or missing references)
		//IL_01ce: Unknown result type (might be due to invalid IL or missing references)
		//IL_01da: Expected Obj, but got Unknown
		//IL_019a: Unknown result type (might be due to invalid IL or missing references)
		//IL_019f: Unknown result type (might be due to invalid IL or missing references)
		//IL_01ab: Unknown result type (might be due to invalid IL or missing references)
		//IL_01b7: Expected Obj, but got Unknown
		//IL_01e0: Unknown result type (might be due to invalid IL or missing references)
		//IL_01e5: Unknown result type (might be due to invalid IL or missing references)
		//IL_01f1: Unknown result type (might be due to invalid IL or missing references)
		//IL_01fd: Expected Obj, but got Unknown
		//IL_026c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0271: Unknown result type (might be due to invalid IL or missing references)
		//IL_027d: Unknown result type (might be due to invalid IL or missing references)
		//IL_0289: Expected Obj, but got Unknown
		//IL_0249: Unknown result type (might be due to invalid IL or missing references)
		//IL_024e: Unknown result type (might be due to invalid IL or missing references)
		//IL_025a: Unknown result type (might be due to invalid IL or missing references)
		//IL_0266: Expected Obj, but got Unknown
		//IL_0226: Unknown result type (might be due to invalid IL or missing references)
		//IL_022b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0237: Unknown result type (might be due to invalid IL or missing references)
		//IL_0243: Expected Obj, but got Unknown
		//IL_02d9: Unknown result type (might be due to invalid IL or missing references)
		//IL_02de: Unknown result type (might be due to invalid IL or missing references)
		//IL_02ea: Unknown result type (might be due to invalid IL or missing references)
		//IL_02f6: Expected Obj, but got Unknown
		//IL_02f7: Unknown result type (might be due to invalid IL or missing references)
		//IL_02f8: Unknown result type (might be due to invalid IL or missing references)
		bool flag = true;
		if (_msgType == msgType && string.Equals(_rawMessage, message))
		{
			switch ((int)msgType)
			{
			case 5:
				flag = _newRxRequest == null;
				break;
			case 1:
				flag = _canRxRequest == null;
				break;
			case 7:
			case 10:
				flag = _refresMessage == null;
				break;
			case 6:
			case 9:
				flag = _refreqMessage == null;
				break;
			case 8:
				flag = _resuppMessage == null;
				break;
			case 2:
				flag = _censusRequest == null;
				break;
			case 13:
				flag = _rxFillIndicatorChangeMessage == null;
				break;
			case 12:
				flag = _chgresMessage == null;
				break;
			case 11:
				flag = _chgreqMessage == null;
				break;
			case 3:
				flag = _incMessage == null;
				break;
			case 4:
				flag = _newOrder == null;
				break;
			case 0:
				flag = _cancelRxResponse == null;
				break;
			case 14:
				flag = _recertificationMessage == null;
				break;
			}
		}
		if (flag)
		{
			switch ((int)msgType)
			{
			case 5:
				_newRxRequest = new NEWRXRequest
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 1:
				_canRxRequest = new RxCancelRequestMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 7:
			case 10:
				_refresMessage = new RefillResponseMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 6:
			case 9:
				_refreqMessage = new RefillRequestMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 8:
				_resuppMessage = new ResupplyMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 2:
				_censusRequest = new CensusRequest
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 13:
				_rxFillIndicatorChangeMessage = new RxFillIndicatorChangeMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 12:
				_chgresMessage = new RxChangeResponseMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 11:
				_chgreqMessage = new RxChangeRequestMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			case 3:
				_incMessage = new IncomingMessage
				{
					Message = message
				};
				break;
			case 4:
				_newOrder = new NewOrder
				{
					ConnectionString = _connectionString
				};
				_newOrder.Parse(message);
				break;
			case 0:
				_cancelRxResponse = new RxCancelResponseMessage
				{
					Message = message
				};
				break;
			case 14:
				_recertificationMessage = new RecertificationMessage
				{
					ConnectionString = _connectionString,
					Message = message
				};
				break;
			}
			_msgType = msgType;
			_rawMessage = message;
		}
	}

	private Gender? TranslateMsgGender(string msgGender)
	{
		Gender? result = null;
		if (string.Compare(msgGender, EnumExtensions.GetDatabaseValue((Enum)(object)(Gender)0), StringComparison.CurrentCultureIgnoreCase) == 0)
		{
			result = (Gender)0;
		}
		else if (string.Compare(msgGender, EnumExtensions.GetDatabaseValue((Enum)(object)(Gender)1), StringComparison.CurrentCultureIgnoreCase) == 0)
		{
			result = (Gender)1;
		}
		return result;
	}

	private List<AdminTimeModelBase> ParseFacilityAdminTimes(List<FacilitySpecificHoursOfAdministrationTimingType> adminTimes)
	{
		//IL_0052: Unknown result type (might be due to invalid IL or missing references)
		//IL_0057: Unknown result type (might be due to invalid IL or missing references)
		//IL_005e: Unknown result type (might be due to invalid IL or missing references)
		//IL_0069: Unknown result type (might be due to invalid IL or missing references)
		//IL_007a: Expected Obj, but got Unknown
		//IL_0090: Unknown result type (might be due to invalid IL or missing references)
		//IL_0095: Unknown result type (might be due to invalid IL or missing references)
		//IL_009c: Unknown result type (might be due to invalid IL or missing references)
		//IL_00a7: Unknown result type (might be due to invalid IL or missing references)
		//IL_00dc: Expected Obj, but got Unknown
		List<AdminTimeModelBase> list = new List<AdminTimeModelBase>();
		int num = 0;
		for (int i = 0; i < adminTimes.Count; i++)
		{
			FacilitySpecificHoursOfAdministrationTimingType val = adminTimes[i];
			if (val.HoursOfAdministration.Qualifier == "SNOMED" && uint.TryParse(val.HoursOfAdministration.Code, out var result))
			{
				switch (result)
				{
				case 272106006u:
				{
					AdminTimeModelBase val3 = new AdminTimeModelBase
					{
						Split = 1
					};
					num = (val3.AdminTimeNo = num + 1);
					val3.Time = val.HoursOfAdministrationValue;
					list.Add(val3);
					break;
				}
				case 398201009u:
				{
					bool flag = StartTimeHasMatchingEndTime(adminTimes, i);
					AdminTimeModelBase val2 = new AdminTimeModelBase
					{
						Split = 1
					};
					num = (val2.AdminTimeNo = num + 1);
					val2.Time = (flag ? (val.HoursOfAdministrationValue + "/" + adminTimes[i + 1].HoursOfAdministrationValue) : val.HoursOfAdministrationValue);
					list.Add(val2);
					break;
				}
				}
			}
		}
		return list;
	}

	private bool StartTimeHasMatchingEndTime(List<FacilitySpecificHoursOfAdministrationTimingType> adminTimes, int idx)
	{
		if (idx < adminTimes.Count - 1 && adminTimes[idx + 1].HoursOfAdministration.Qualifier == "SNOMED")
		{
			if (uint.TryParse(adminTimes[idx + 1].HoursOfAdministration.Code, out var result))
			{
				return result == 397898000;
			}
			return false;
		}
		return false;
	}

	private void DetermineTimesPerDay(ERxHL7MessageData msgData)
	{
		msgData.TimesPerDay = 0;
		if (msgData.Splits.Count == 1)
		{
			msgData.TimesPerDay = GetValidAdminTimesCount(msgData.Splits.First().AdminTimes);
		}
		else
		{
			if (string.Equals(msgData.Splits[0].Conjunction, "A"))
			{
				if (!AllSplitsHaveSameAdminSchedule(msgData.Splits))
				{
					return;
				}
				{
					foreach (ERxSplitInfo split in msgData.Splits)
					{
						msgData.TimesPerDay += GetValidAdminTimesCount(split.AdminTimes);
					}
					return;
				}
			}
			msgData.TimesPerDay = GetValidAdminTimesCount(msgData.Splits.First().AdminTimes);
		}
	}

	private bool AllSplitsHaveSameAdminSchedule(List<ERxSplitInfo> splits)
	{
		//IL_002b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0032: Unknown result type (might be due to invalid IL or missing references)
		//IL_0065: Unknown result type (might be due to invalid IL or missing references)
		//IL_006a: Unknown result type (might be due to invalid IL or missing references)
		//IL_006c: Unknown result type (might be due to invalid IL or missing references)
		//IL_007f: Expected I4, but got Unknown
		bool result = true;
		ERxSplitInfo val = splits[0];
		for (int i = 1; i < splits.Count; i++)
		{
			ERxSplitInfo val2 = splits[i];
			if (val.AdminType == val2.AdminType)
			{
				switch (val2.AdminType)
				{
				case (SigCodeAdministrationType)0L:
					if (val2.Sun != val.Sun || val2.Sat != val.Sat || val2.Fri != val.Fri || val2.Thu != val.Thu || val2.Wed != val.Wed || val2.Tue != val.Tue || val2.Mon != val.Mon)
					{
						return false;
					}
					break;
				case (SigCodeAdministrationType)1L:
					if (val2.AdminEveryNum != val.AdminEveryNum)
					{
						return false;
					}
					break;
				case (SigCodeAdministrationType)2L:
				{
					for (int j = 0; j < 32; j++)
					{
						if (val2.MonthlyDays[j] != val.MonthlyDays[j])
						{
							return false;
						}
					}
					break;
				}
				}
				continue;
			}
			result = false;
			break;
		}
		return result;
	}

	public bool IsValidTime(string s)
	{
		if (string.IsNullOrWhiteSpace(s))
		{
			return false;
		}
		if (DateTime.TryParse(s, out var result))
		{
			return true;
		}
		if (s.Length == 3)
		{
			s = s.Substring(0, 1) + ":" + s.Substring(1, 2);
		}
		else if (s.Length == 4)
		{
			s = s.Substring(0, 2) + ":" + s.Substring(2, 2);
		}
		if (DateTime.TryParse(s, out result))
		{
			return true;
		}
		return false;
	}

	private int GetValidAdminTimesCount(List<string> adminTimes)
	{
		int num = 0;
		foreach (string adminTime in adminTimes)
		{
			if (IsValidTime(adminTime))
			{
				num++;
			}
		}
		return num;
	}

	private void ParseAdminSched(ERxSplitInfo split, string adminSched)
	{
		//IL_0108: Unknown result type (might be due to invalid IL or missing references)
		//IL_010c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0111: Unknown result type (might be due to invalid IL or missing references)
		//IL_0132: Unknown result type (might be due to invalid IL or missing references)
		//IL_0138: Invalid comparison between Unknown and I4
		string text = StringExtensions.RemoveMultipleSpaces(adminSched.Replace("\r\n", " ").Replace("\t", " ").Replace("\r", " ")
			.Replace("\n", " "));
		string text2 = "";
		string[] array = text.Split(new char[1] { ' ' });
		int everyNDays = 0;
		string[] array2 = array;
		foreach (string text3 in array2)
		{
			if (IsDailySchedule(text3))
			{
				split.AdminType = (SigCodeAdministrationType)0;
				text2 = text3;
			}
			else if (IsEveryNDaysSchedule(text3, out everyNDays))
			{
				split.AdminType = (SigCodeAdministrationType)1;
				split.AdminEveryNum = everyNDays;
				text2 = text3;
			}
			else if (IsMonthlySchedule(text3))
			{
				split.AdminType = (SigCodeAdministrationType)2;
				text2 = text3;
			}
		}
		if (!string.IsNullOrEmpty(text2))
		{
			split.Mon = false;
			split.Tue = false;
			split.Wed = false;
			split.Thu = false;
			split.Fri = false;
			split.Sat = false;
			split.Sun = false;
			if (split.AdminType == (SigCodeAdministrationType?)0)
			{
				ParseDailySchedule(split, text2);
			}
			else if ((int)split.AdminType.GetValueOrDefault() == 2)
			{
				ParseMonthlySchedule(split, text2);
			}
		}
	}

	private bool IsDailySchedule(string schedCode)
	{
		if (!string.IsNullOrWhiteSpace(schedCode) && schedCode.StartsWith("QJ"))
		{
			string text = schedCode.Substring(2);
			if (text.Length <= 0)
			{
				return true;
			}
			List<char> list = new List<char> { '1', '2', '3', '4', '5', '6', '7' };
			bool flag = true;
			for (int i = 0; i < text.Length; i++)
			{
				if (!list.Contains(text[i]))
				{
					flag = false;
					break;
				}
			}
			if (flag)
			{
				return true;
			}
		}
		return false;
	}

	private bool IsEveryNDaysSchedule(string schedCode, out int everyNDays)
	{
		everyNDays = 0;
		if (!string.IsNullOrWhiteSpace(schedCode) && schedCode.StartsWith("Q") && schedCode.EndsWith("D") && int.TryParse(schedCode.Substring(1, schedCode.Length - 2), out everyNDays) && everyNDays >= 2 && everyNDays <= 999)
		{
			return true;
		}
		return false;
	}

	private bool IsMonthlySchedule(string schedCode)
	{
		if (!string.IsNullOrWhiteSpace(schedCode) && schedCode.StartsWith("QL"))
		{
			string text = schedCode.Substring(2);
			if (text.Length > 0)
			{
				bool flag = true;
				string[] array = text.Split(new char[1] { ',' });
				for (int i = 0; i < array.Length; i++)
				{
					if (int.TryParse(array[i], out var result))
					{
						if (result < 1 || result > 31)
						{
							flag = false;
							break;
						}
					}
					else
					{
						flag = false;
					}
				}
				if (flag)
				{
					return true;
				}
			}
		}
		return false;
	}

	private void ParseDailySchedule(ERxSplitInfo split, string schedCode)
	{
		if (!string.IsNullOrWhiteSpace(schedCode) && schedCode.Length > 2)
		{
			string text = schedCode.Substring(2);
			for (int i = 0; i < text.Length; i++)
			{
				switch (text[i])
				{
				case '1':
					split.Mon = true;
					break;
				case '2':
					split.Tue = true;
					break;
				case '3':
					split.Wed = true;
					break;
				case '4':
					split.Thu = true;
					break;
				case '5':
					split.Fri = true;
					break;
				case '6':
					split.Sat = true;
					break;
				case '7':
					split.Sun = true;
					break;
				}
			}
		}
		else
		{
			split.Mon = true;
			split.Tue = true;
			split.Wed = true;
			split.Thu = true;
			split.Fri = true;
			split.Sat = true;
			split.Sun = true;
		}
	}

	private void ParseMonthlySchedule(ERxSplitInfo split, string schedCode)
	{
		if (string.IsNullOrWhiteSpace(schedCode) || schedCode.Length <= 2)
		{
			return;
		}
		string[] array = schedCode.Substring(2).Split(new char[1] { ',' });
		for (int i = 0; i < array.Length; i++)
		{
			if (int.TryParse(array[i].Trim(), out var result) && result >= 0 && result < 32)
			{
				split.MonthlyDays[result] = true;
			}
		}
	}
}
