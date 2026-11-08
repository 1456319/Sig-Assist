using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Microsoft.VisualBasic.CompilerServices;
using Softwriters.SCRIPT.Xml;

namespace Softwriters.SCRIPT;

public class NEWRXRequest
{
	private string _message;

	private XmlMessage _xmlMessage;

	private PrescriberType _prescriberType;

	private PrescriberType _supervisorType;

	private PrescriberType _followUpPrescriberType;

	private PharmacyType _pharmacyType;

	private FacilityType _facilityType;

	private PatientType _patientType;

	private MedicationType _medicationType;

	private ObservationType _observationType;

	private List<BenefitsCoordinationType> _benefitCoordinationTypes;

	private AllergyOrAdverseEventType _adverseEventAllergyType;

	private StructuredSigType _sig;

	private string _connectionString;

	public string Message
	{
		get
		{
			return _message;
		}
		set
		{
			_message = value;
		}
	}

	public string ConnectionString
	{
		get
		{
			return _connectionString;
		}
		set
		{
			_connectionString = value.Replace("Provider=SQLNCLI11;", "");
		}
	}

	public string PrescriberNPI
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Identification == null)
			{
				return string.Empty;
			}
			return _prescriberType.Identification.NPI;
		}
	}

	public string PrescriberSPI
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Identification == null)
			{
				return string.Empty;
			}
			return _prescriberType.Identification.SPI;
		}
	}

	public string PrescriberDEA
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Identification == null)
			{
				return string.Empty;
			}
			return _prescriberType.Identification.DEANumber;
		}
	}

	public string PrescriberStateLicenseNo
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Name == null)
			{
				return string.Empty;
			}
			return _prescriberType.Identification.StateLicenseNumber;
		}
	}

	public string PrescriberLastName
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Name == null)
			{
				return string.Empty;
			}
			return _prescriberType.Name.LastName;
		}
	}

	public string PrescriberFirstName
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Name == null)
			{
				return string.Empty;
			}
			return _prescriberType.Name.FirstName;
		}
	}

	public string PrescriberStreetAddress
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Address == null)
			{
				return string.Empty;
			}
			return _prescriberType.Address.AddressLine1;
		}
	}

	public string PrescriberCity
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Address == null)
			{
				return string.Empty;
			}
			return _prescriberType.Address.City;
		}
	}

	public string PrescriberState
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Address == null)
			{
				return string.Empty;
			}
			return _prescriberType.Address.StateProvince;
		}
	}

	public string PrescriberZip
	{
		get
		{
			if (_prescriberType == null || _prescriberType.Address == null)
			{
				return string.Empty;
			}
			return _prescriberType.Address.PostalCode;
		}
	}

	public string PrescriberPhone
	{
		get
		{
			if (_prescriberType == null || _prescriberType.CommunicationNumbers == null || _prescriberType.CommunicationNumbers.PrimaryTelephone == null)
			{
				return string.Empty;
			}
			return _prescriberType.CommunicationNumbers.PrimaryTelephone.Number;
		}
	}

	public string PrescriberFax
	{
		get
		{
			if (_prescriberType == null || _prescriberType.CommunicationNumbers == null || !_prescriberType.CommunicationNumbers.Faxes.Any())
			{
				return string.Empty;
			}
			return _prescriberType.CommunicationNumbers.Faxes.FirstOrDefault().Number;
		}
	}

	public string PrescriberEmail
	{
		get
		{
			if (_prescriberType == null || _prescriberType.CommunicationNumbers == null)
			{
				return string.Empty;
			}
			return _prescriberType.CommunicationNumbers.ElectronicMail;
		}
	}

	public string PrescriberAgentName
	{
		get
		{
			if (_prescriberType == null || _prescriberType.PrescriberAgent == null || _prescriberType.PrescriberAgent.Name == null)
			{
				return string.Empty;
			}
			return _prescriberType.PrescriberAgent.Name.FullName();
		}
	}

	public string PharmacyProviderID
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Identification == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Identification.NCPDPID;
		}
	}

	public string PharmacyNPI
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Identification == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Identification.NPI;
		}
	}

	public string PharmacyName
	{
		get
		{
			if (_pharmacyType == null)
			{
				return string.Empty;
			}
			return _pharmacyType.BusinessName;
		}
	}

	public string PharmacyStreetAddress
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Address == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Address.AddressLine1;
		}
	}

	public string PharmacyCity
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Address == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Address.City;
		}
	}

	public string PharmacyState
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Address == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Address.StateProvince;
		}
	}

	public string PharmacyZip
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Address == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Address.PostalCode;
		}
	}

	public string PharmacyPhone
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.CommunicationNumbers == null || _pharmacyType.CommunicationNumbers.PrimaryTelephone == null)
			{
				return string.Empty;
			}
			return _pharmacyType.CommunicationNumbers.PrimaryTelephone.Number;
		}
	}

	public string PharmacyFax
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.CommunicationNumbers == null || !_pharmacyType.CommunicationNumbers.Faxes.Any())
			{
				return string.Empty;
			}
			return _pharmacyType.CommunicationNumbers.Faxes.FirstOrDefault().Number;
		}
	}

	public string PharmacistLastName
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Pharmacist == null || _pharmacyType.Pharmacist.Name == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Pharmacist.Name.LastName;
		}
	}

	public string PharmacistFirstName
	{
		get
		{
			if (_pharmacyType == null || _pharmacyType.Pharmacist == null || _pharmacyType.Pharmacist.Name == null)
			{
				return string.Empty;
			}
			return _pharmacyType.Pharmacist.Name.FirstName;
		}
	}

	public string FacilityName
	{
		get
		{
			if (_facilityType == null)
			{
				return string.Empty;
			}
			return _facilityType.FacilityName;
		}
	}

	public string FacilityStreetAddress
	{
		get
		{
			if (_facilityType == null || _facilityType.Address == null)
			{
				return string.Empty;
			}
			return _facilityType.Address.AddressLine1;
		}
	}

	public string FacilityCity
	{
		get
		{
			if (_facilityType == null || _facilityType.Address == null)
			{
				return string.Empty;
			}
			return _facilityType.Address.City;
		}
	}

	public string FacilityState
	{
		get
		{
			if (_facilityType == null || _facilityType.Address == null)
			{
				return string.Empty;
			}
			return _facilityType.Address.StateProvince;
		}
	}

	public string FacilityZip
	{
		get
		{
			if (_facilityType == null || _facilityType.Address == null)
			{
				return string.Empty;
			}
			return _facilityType.Address.PostalCode;
		}
	}

	public string FacilityPhone
	{
		get
		{
			if (_facilityType == null || _facilityType.CommunicationNumbers == null || _facilityType.CommunicationNumbers.PrimaryTelephone == null)
			{
				return string.Empty;
			}
			return _facilityType.CommunicationNumbers.PrimaryTelephone.Number;
		}
	}

	public string FacilityFax
	{
		get
		{
			if (_facilityType == null || _facilityType.CommunicationNumbers == null || !_facilityType.CommunicationNumbers.Faxes.Any())
			{
				return string.Empty;
			}
			return _facilityType.CommunicationNumbers.Faxes.FirstOrDefault().Number;
		}
	}

	public string FacilityNPI
	{
		get
		{
			if (_facilityType == null || _facilityType.Identification == null)
			{
				return string.Empty;
			}
			return _facilityType.Identification.NPI;
		}
	}

	public string PatientDOB => _patientType.DateOfBirth;

	public string PatientLastName
	{
		get
		{
			if (_patientType == null || _patientType.Name == null)
			{
				return string.Empty;
			}
			return _patientType.Name.LastName;
		}
	}

	public string PatientFirstName
	{
		get
		{
			if (_patientType == null || _patientType.Name == null)
			{
				return string.Empty;
			}
			return _patientType.Name.FirstName;
		}
	}

	public string PatientMiddleName
	{
		get
		{
			if (_patientType == null || _patientType.Name == null)
			{
				return string.Empty;
			}
			return _patientType.Name.MiddleName;
		}
	}

	public string PatientGender => _patientType.Gender;

	public string PatientSSN
	{
		get
		{
			if (_patientType == null || _patientType.Identification == null)
			{
				return string.Empty;
			}
			return _patientType.Identification.SocialSecurity;
		}
	}

	public string PatientStreetAddress
	{
		get
		{
			if (_patientType == null || _patientType.Address == null)
			{
				return string.Empty;
			}
			return _patientType.Address.AddressLine1;
		}
	}

	public string PatientCity
	{
		get
		{
			if (_patientType == null || _patientType.Address == null)
			{
				return string.Empty;
			}
			return _patientType.Address.City;
		}
	}

	public string PatientState
	{
		get
		{
			if (_patientType == null || _patientType.Address == null)
			{
				return string.Empty;
			}
			return _patientType.Address.StateProvince;
		}
	}

	public string PatientZip
	{
		get
		{
			if (_patientType == null || _patientType.Address == null)
			{
				return string.Empty;
			}
			return _patientType.Address.PostalCode;
		}
	}

	public string PatientPhone
	{
		get
		{
			if (_patientType == null || _patientType.CommunicationNumbers == null || _patientType.CommunicationNumbers.PrimaryTelephone == null)
			{
				return string.Empty;
			}
			return _patientType.CommunicationNumbers.PrimaryTelephone.Number;
		}
	}

	public string PatientFacilityUnit
	{
		get
		{
			if (_patientType == null || _patientType.PatientLocation == null)
			{
				return string.Empty;
			}
			return _patientType.PatientLocation.FacilityUnit;
		}
	}

	public string PatientRoom
	{
		get
		{
			if (_patientType == null || _patientType.PatientLocation == null)
			{
				return string.Empty;
			}
			return _patientType.PatientLocation.Room;
		}
	}

	public string PatientBed
	{
		get
		{
			if (_patientType == null || _patientType.PatientLocation == null)
			{
				return string.Empty;
			}
			return _patientType.PatientLocation.Bed;
		}
	}

	public string MessageType => _medicationType.MessageType;

	public string DrugName
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			return _medicationType.DrugDescription;
		}
	}

	public string NDC
	{
		get
		{
			if (_medicationType == null || _medicationType.DrugCoded == null || _medicationType.DrugCoded.ProductCode == null)
			{
				return string.Empty;
			}
			if (Operators.CompareString(_medicationType.DrugCoded.ProductCode.Qualifier.ToUpper(), "ND", TextCompare: true) == 0)
			{
				return _medicationType.DrugCoded.ProductCode.Code;
			}
			return string.Empty;
		}
	}

	public string DosageForm
	{
		get
		{
			if (_medicationType == null || _medicationType.DrugCoded == null || _medicationType.DrugCoded.Strength == null)
			{
				return string.Empty;
			}
			if (!string.IsNullOrWhiteSpace(_medicationType.DrugCoded.Strength.StrengthForm))
			{
				return CodeLists.GetPharmaceuticalDosageFormValue(_medicationType.DrugCoded.Strength.StrengthForm, DataLayerAccess.SqlConnectionString);
			}
			return string.Empty;
		}
	}

	public string Strength
	{
		get
		{
			if (_medicationType == null || _medicationType.DrugCoded == null || _medicationType.DrugCoded.Strength == null)
			{
				return string.Empty;
			}
			string text = _medicationType.DrugCoded.Strength.StrengthValue;
			string strengthUnitofMeasure = _medicationType.DrugCoded.Strength.StrengthUnitofMeasure;
			if (!string.IsNullOrWhiteSpace(text) && !string.IsNullOrWhiteSpace(strengthUnitofMeasure))
			{
				text = $"{text} {CodeLists.GetPotencyUnitCodeValue(strengthUnitofMeasure, DataLayerAccess.SqlConnectionString)}";
			}
			return text.Trim();
		}
	}

	public string GPI
	{
		get
		{
			if (_medicationType == null || _medicationType.DrugCoded == null || _medicationType.DrugCoded.DrugDBCode == null)
			{
				return string.Empty;
			}
			if (Operators.CompareString(_medicationType.DrugCoded.DrugDBCode.Qualifier, "MG", TextCompare: true) == 0)
			{
				return _medicationType.DrugCoded.DrugDBCode.Code;
			}
			return string.Empty;
		}
	}

	public string QuantityUOM
	{
		get
		{
			if (_medicationType == null || _medicationType.Quantity == null)
			{
				return string.Empty;
			}
			return _medicationType.Quantity.QuantityUnitOfMeasure;
		}
	}

	public double Quantity
	{
		get
		{
			if (_medicationType == null || _medicationType.Quantity == null)
			{
				return 0.0;
			}
			return Convert.ToDouble(_medicationType.Quantity.Value);
		}
	}

	public string QuantityQualifier
	{
		get
		{
			if (_medicationType == null || _medicationType.Quantity == null)
			{
				return string.Empty;
			}
			return _medicationType.Quantity.Qualifier;
		}
	}

	public string Directions
	{
		get
		{
			if (_medicationType == null || _medicationType.Sig == null)
			{
				return string.Empty;
			}
			return _medicationType.Sig.SigText;
		}
	}

	public int DaysSupply
	{
		get
		{
			if (_medicationType == null || _medicationType.DaysSupply == int.MinValue)
			{
				return 0;
			}
			return _medicationType.DaysSupply;
		}
	}

	public string DateWritten
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string result = _medicationType.WrittenDate;
			if (DateTime.TryParse(_medicationType.WrittenDate, out var result2))
			{
				result = ((!_medicationType.WrittenDate.Contains("Z")) ? result2.ToString("MM/dd/yyyy") : result2.ToLocalTime().ToString("MM/dd/yyyy"));
			}
			return result;
		}
	}

	public string EffectiveDate
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string result = string.Empty;
			if (_medicationType.OtherMedicationDates != null && _medicationType.OtherMedicationDates.Any())
			{
				OtherMedicationDateType otherMedicationDateType = new OtherMedicationDateType();
				otherMedicationDateType = _medicationType.OtherMedicationDates.FirstOrDefault([SpecialName] (OtherMedicationDateType otherMedicationDate) => string.Equals(otherMedicationDate.OtherMedicationDateQualifier, "effectivedate", StringComparison.OrdinalIgnoreCase));
				if (otherMedicationDateType != null && DateTime.TryParse(Conversions.ToString(otherMedicationDateType.OtherMedicationDate.Value), out var result2))
				{
					result = ((otherMedicationDateType.OtherMedicationDate.Type != XmlDate.DateType.DateAndTime) ? result2.ToString("MM/dd/yyyy") : result2.ToLocalTime().ToString("MM/dd/yyyy HH:mm"));
				}
			}
			return result;
		}
	}

	public string StartDate
	{
		get
		{
			string result = string.Empty;
			if (_medicationType == null)
			{
				return string.Empty;
			}
			if (_medicationType.OtherMedicationDates != null && _medicationType.OtherMedicationDates.Any())
			{
				OtherMedicationDateType otherMedicationDateType = new OtherMedicationDateType();
				otherMedicationDateType = _medicationType.OtherMedicationDates.FirstOrDefault([SpecialName] (OtherMedicationDateType otherMedicationDate) => string.Equals(otherMedicationDate.OtherMedicationDateQualifier, "startdate", StringComparison.OrdinalIgnoreCase));
				if (otherMedicationDateType != null && DateTime.TryParse(Conversions.ToString(otherMedicationDateType.OtherMedicationDate.Value), out var result2))
				{
					result = ((otherMedicationDateType.OtherMedicationDate.Type != XmlDate.DateType.DateAndTime) ? result2.ToString("MM/dd/yyyy") : result2.ToLocalTime().ToString("MM/dd/yyyy HH:mm"));
				}
			}
			return result;
		}
	}

	public string PeriodEnd
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string result = string.Empty;
			if (_medicationType.OtherMedicationDates != null && _medicationType.OtherMedicationDates.Any())
			{
				OtherMedicationDateType otherMedicationDateType = new OtherMedicationDateType();
				otherMedicationDateType = _medicationType.OtherMedicationDates.FirstOrDefault([SpecialName] (OtherMedicationDateType otherMedicationDate) => string.Equals(otherMedicationDate.OtherMedicationDateQualifier, "periodend", StringComparison.OrdinalIgnoreCase));
				if (otherMedicationDateType != null && DateTime.TryParse(Conversions.ToString(otherMedicationDateType.OtherMedicationDate.Value), out var result2))
				{
					result = ((otherMedicationDateType.OtherMedicationDate.Type != XmlDate.DateType.DateAndTime) ? result2.ToString("MM/dd/yyyy") : result2.ToLocalTime().ToString("MM/dd/yyyy HH:mm"));
				}
			}
			return result;
		}
	}

	public string DAW
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			return _medicationType.Substitutions;
		}
	}

	public string DAWText
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			return CodeLists.GetProductServiceSubstitutionText(_medicationType.Substitutions);
		}
	}

	public int Refills
	{
		get
		{
			if (_medicationType == null || _medicationType.NumberOfRefills == short.MinValue)
			{
				return 0;
			}
			return _medicationType.NumberOfRefills;
		}
	}

	public string AssocDx
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string result = string.Empty;
			if (_medicationType.Diagnosis != null && _medicationType.Diagnosis.Any() && _medicationType.Diagnosis[0].Primary != null)
			{
				result = _medicationType.Diagnosis[0].Primary.Code;
			}
			return result;
		}
	}

	public string AssocDxType
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string result = string.Empty;
			if (_medicationType.Diagnosis != null && _medicationType.Diagnosis.Any() && _medicationType.Diagnosis[0].Primary != null)
			{
				result = _medicationType.Diagnosis[0].Primary.Qualifier.ToUpper();
			}
			return result;
		}
	}

	public string Notes
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			return _medicationType.Note;
		}
	}

	public bool ProfileOnly
	{
		get
		{
			if (_medicationType == null)
			{
				return Conversions.ToBoolean(string.Empty);
			}
			return Operators.CompareString(_medicationType.DoNotFill.ToUpper(), "Y", TextCompare: true) == 0 || Operators.CompareString(_medicationType.DoNotFill.ToUpper(), "E", TextCompare: true) == 0;
		}
	}

	public string NeededNoLaterThan
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			if (_medicationType.NeedNoLaterThan == null || string.IsNullOrWhiteSpace(_medicationType.NeedNoLaterThan.NeedNoLaterThanDate))
			{
				return string.Empty;
			}
			return _medicationType.NeedNoLaterThan.NeedNoLaterThanDate;
		}
	}

	public string NeededNoLaterThanReason
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			string text = string.Empty;
			if (_medicationType.NeedNoLaterThan != null && _medicationType.NeedNoLaterThan.NeedNoLaterThanReasons.Any())
			{
				foreach (string needNoLaterThanReason in _medicationType.NeedNoLaterThan.NeedNoLaterThanReasons)
				{
					text = $"{text} {needNoLaterThanReason}";
				}
			}
			return text.Trim();
		}
	}

	public bool IsACompound
	{
		get
		{
			if (_medicationType == null)
			{
				return Conversions.ToBoolean(string.Empty);
			}
			return _medicationType.CompoundInformation != null && _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any();
		}
	}

	public int CompoundIngredsCount
	{
		get
		{
			if (_medicationType == null || _medicationType.CompoundInformation == null)
			{
				return 0;
			}
			return _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Count;
		}
	}

	// C# has no syntax for parameterized property 'CompoundIngredNDC'.
	public string get_CompoundIngredNDC(int index)
	{
		if (_medicationType == null || _medicationType.CompoundInformation == null || !_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any())
		{
			return string.Empty;
		}
		return _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.ElementAt(index).CompoundIngredient.ItemNumber.Code;
	}

	// C# has no syntax for parameterized property 'CompoundIngredDescription'.
	public string get_CompoundIngredDescription(int index)
	{
		if (_medicationType == null || _medicationType.CompoundInformation == null || !_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any())
		{
			return string.Empty;
		}
		return _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.ElementAt(index).CompoundIngredient.CompoundIngredientItemDescription;
	}

	// C# has no syntax for parameterized property 'CompoundIngredQuantity'.
	public string get_CompoundIngredQuantity(int index)
	{
		if (_medicationType == null || _medicationType.CompoundInformation == null || !_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any())
		{
			return string.Empty;
		}
		return Conversions.ToString(_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.ElementAt(index).Quantity.Value);
	}

	// C# has no syntax for parameterized property 'CompoundIngredDosageForm'.
	public string get_CompoundIngredDosageForm(int index)
	{
		if (_medicationType == null || _medicationType.CompoundInformation == null || !_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any())
		{
			return string.Empty;
		}
		return _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.ElementAt(index).CompoundIngredient.Strength.StrengthForm;
	}

	// C# has no syntax for parameterized property 'CompoundIngredStrength'.
	public string get_CompoundIngredStrength(int index)
	{
		if (_medicationType == null || _medicationType.CompoundInformation == null || !_medicationType.CompoundInformation.CompoundIngredientLotNotUsed.Any())
		{
			return string.Empty;
		}
		return _medicationType.CompoundInformation.CompoundIngredientLotNotUsed.ElementAt(index).CompoundIngredient.Strength.StrengthValue;
	}

	public string RxReferenceNumber => _xmlMessage.RxReferenceNumber;

	public string PrescriberOrderNumber => _xmlMessage.PrescriberOrderNumber;

	public string ProhibitRenewalRequest => _xmlMessage.ProhibitRenewalRequest;

	public string UrgencyIndicatorCode
	{
		get
		{
			if (_xmlMessage.Request != null)
			{
				return _xmlMessage.Request.UrgencyIndicatorCode;
			}
			return string.Empty;
		}
	}

	public string RxFillIndicator
	{
		get
		{
			if (_medicationType == null)
			{
				return string.Empty;
			}
			return _medicationType.RxFillIndicator;
		}
	}

	public bool SignatureFlag
	{
		get
		{
			if (_medicationType == null)
			{
				return false;
			}
			return _xmlMessage.DigitalSignatureIndicator || _medicationType.DrugCoverageStatusCodes.Contains("SI", StringComparer.OrdinalIgnoreCase);
		}
	}

	public StructuredSigCollection StructuredSigs
	{
		get
		{
			StructuredSigCollection structuredSigCollection = new StructuredSigCollection();
			short num = 0;
			List<StructuredSigInstructionType> instructions = _sig.Instructions;
			List<string> multipleInstructionModifiers = _sig.MultipleInstructionModifiers;
			checked
			{
				if (instructions.Any())
				{
					structuredSigCollection = new StructuredSigCollection();
					foreach (StructuredSigInstructionType item in instructions)
					{
						StructuredSig structuredSig = new StructuredSig();
						structuredSig.SigFreeText = _sig.SigText;
						if (item.DoseAdministration != null)
						{
							if (item.DoseAdministration.DoseDeliveryMethod != null)
							{
								structuredSig.DoseDeliveryMethodText = item.DoseAdministration.DoseDeliveryMethod.Text;
								structuredSig.DoseDeliveryMethodCode = item.DoseAdministration.DoseDeliveryMethod.Code;
							}
							if (item.DoseAdministration.Dosages.Any() && decimal.Compare(item.DoseAdministration.Dosages[0].DoseQuantity, decimal.MinValue) != 0)
							{
								structuredSig.DoseQuantity = item.DoseAdministration.Dosages[0].DoseQuantity;
								if (item.DoseAdministration.Dosages[0].DoseUnitOfMeasure != null)
								{
									structuredSig.DoseFormText = item.DoseAdministration.Dosages[0].DoseUnitOfMeasure.Text;
									structuredSig.DoseFormCode = item.DoseAdministration.Dosages[0].DoseUnitOfMeasure.Code;
								}
							}
							if (item.DoseAdministration.RouteofAdministration != null)
							{
								structuredSig.RouteOfAdministrationText = item.DoseAdministration.RouteofAdministration.Text;
								structuredSig.RouteOfAdministrationCode = item.DoseAdministration.RouteofAdministration.Code;
							}
						}
						if (item.IndicationForUses.Any())
						{
							IndicationForUseType indicationForUseType = item.IndicationForUses[0];
							if (indicationForUseType.IndicationPrecursor != null)
							{
								structuredSig.IndicationPrecursorCode = indicationForUseType.IndicationPrecursor.Code;
								structuredSig.IndicationPrecursorText = indicationForUseType.IndicationPrecursor.Text;
							}
							if (indicationForUseType.Indication != null)
							{
								structuredSig.IndicationText = indicationForUseType.Indication.Text;
							}
						}
						if (item.TimingAndDuration.Any())
						{
							TimingAndDurationType timingAndDurationType = item.TimingAndDuration[0];
							if (timingAndDurationType.Frequency != null && decimal.Compare(timingAndDurationType.Frequency.FrequencyNumericValue, decimal.MinValue) != 0)
							{
								structuredSig.FrequencyNumericValue = timingAndDurationType.Frequency.FrequencyNumericValue;
								if (timingAndDurationType.Frequency.FrequencyUnits != null)
								{
									structuredSig.FrequencyUnitsCode = timingAndDurationType.Frequency.FrequencyUnits.Code;
									structuredSig.FrequencyUnitsText = timingAndDurationType.Frequency.FrequencyUnits.Text;
								}
							}
							if (timingAndDurationType.Interval != null && decimal.Compare(timingAndDurationType.Interval.IntervalNumericValue, decimal.MinValue) != 0)
							{
								structuredSig.IntervalNumericValue = timingAndDurationType.Interval.IntervalNumericValue;
								if (timingAndDurationType.Interval.IntervalUnits != null)
								{
									structuredSig.IntervalUnitsCode = timingAndDurationType.Interval.IntervalUnits.Code;
									structuredSig.IntervalUnitsText = timingAndDurationType.Interval.IntervalUnits.Text;
								}
							}
							if (timingAndDurationType.AdministrationTiming != null && timingAndDurationType.AdministrationTiming.AdministrationTimingEvent != null)
							{
								structuredSig.AdministrationTimingCode = timingAndDurationType.AdministrationTiming.AdministrationTimingEvent.Code;
								structuredSig.AdministrationTimingText = timingAndDurationType.AdministrationTiming.AdministrationTimingEvent.Text;
							}
							if (timingAndDurationType.Duration != null && decimal.Compare(timingAndDurationType.Duration.DurationNumericValue, decimal.MinValue) != 0)
							{
								structuredSig.DurationNumericValue = timingAndDurationType.Duration.DurationNumericValue;
								if (timingAndDurationType.Duration.DurationText != null)
								{
									structuredSig.DurationText = timingAndDurationType.Duration.DurationText.Text;
									structuredSig.DurationTextCode = timingAndDurationType.Duration.DurationText.Code;
								}
							}
						}
						num++;
						if (multipleInstructionModifiers.Any() && multipleInstructionModifiers.Count >= num)
						{
							structuredSig.MultipleSigModifier = multipleInstructionModifiers[num - 1];
						}
						structuredSigCollection.Add(structuredSig);
					}
					return structuredSigCollection;
				}
				return null;
			}
		}
	}

	public List<FacilitySpecificHoursOfAdministrationTimingType> FacilitySpecificHoursOfAdministrationTimings
	{
		get
		{
			if (_medicationType == null || _medicationType.FacilitySpecificHoursOfAdministrationTimings == null)
			{
				return null;
			}
			return _medicationType.FacilitySpecificHoursOfAdministrationTimings;
		}
	}

	public NEWRXRequest()
	{
		_message = string.Empty;
		_benefitCoordinationTypes = new List<BenefitsCoordinationType>();
		_connectionString = string.Empty;
	}

	public NEWRXRequest(string message, string connectionString)
	{
		_message = string.Empty;
		_benefitCoordinationTypes = new List<BenefitsCoordinationType>();
		_connectionString = string.Empty;
		_connectionString = connectionString;
		DataLayerAccess.CreateConnection(_connectionString);
		_xmlMessage = new XmlMessage(message);
		ParseMessage();
	}

	private void ParseMessage()
	{
		_prescriberType = _xmlMessage.Prescriber;
		_supervisorType = _xmlMessage.Supervisor;
		_pharmacyType = _xmlMessage.Pharmacy;
		_patientType = _xmlMessage.Patient;
		_facilityType = _xmlMessage.Facility;
		_medicationType = _xmlMessage.MedicationPrescribed;
		_observationType = _xmlMessage.Observation;
		_adverseEventAllergyType = _xmlMessage.AllergyOrAdverseEvent;
		_benefitCoordinationTypes = _xmlMessage.BenefitsCoordination;
		_followUpPrescriberType = _xmlMessage.FollowUpPrescriber;
		_sig = _medicationType.Sig;
	}

	public FieldCollection GetFields()
	{
		FieldCollection fieldCollection = new FieldCollection();
		bool flag = false;
		if (_xmlMessage.Request != null)
		{
			string text = CodeLists.MessageFunctionCodeText(_xmlMessage.Request.MessageRequestCode);
			if (!string.IsNullOrWhiteSpace(text) || !string.IsNullOrWhiteSpace(_xmlMessage.Request.UrgencyIndicatorCode) || !string.IsNullOrWhiteSpace(_xmlMessage.Request.ChangeOfPrescriptionStatusFlag))
			{
				fieldCollection.Add(string.Empty, "Request Information", "H");
				flag = true;
				if (!string.IsNullOrWhiteSpace(_xmlMessage.Request.UrgencyIndicatorCode))
				{
					fieldCollection.Add("Urgency Indicator Code", $"{_xmlMessage.Request.UrgencyIndicatorCode} - {_xmlMessage.Request.UrgencyIndicatorCodeText}", (Operators.CompareString(_xmlMessage.Request.UrgencyIndicatorCode.Trim().ToUpper(), "X", TextCompare: true) == 0) ? "D" : "");
				}
				if (!string.IsNullOrWhiteSpace(text))
				{
					fieldCollection.Add("Change Request Type", text);
				}
				if (!string.IsNullOrWhiteSpace(_xmlMessage.Request.ChangeOfPrescriptionStatusFlag))
				{
					fieldCollection.Add("Change of Prescription Status", $"{_xmlMessage.Request.ChangeOfPrescriptionStatusFlag} - {_xmlMessage.Request.ChangeOfPrescriptionStatusFlagText}");
				}
			}
		}
		if (!string.IsNullOrWhiteSpace(_xmlMessage.ProhibitRenewalRequest))
		{
			if (!flag)
			{
				fieldCollection.Add(string.Empty, "Request Information", "H");
			}
			fieldCollection.Add("Prohibit Renewal Request", _xmlMessage.ProhibitRenewalRequest);
		}
		if (_pharmacyType != null)
		{
			_pharmacyType.GetFields(fieldCollection);
		}
		if (_facilityType != null)
		{
			_facilityType.GetFields(fieldCollection);
		}
		if (_prescriberType != null)
		{
			_prescriberType.Type = "R";
			_prescriberType.GetFields(fieldCollection);
		}
		if (_supervisorType != null)
		{
			_supervisorType.Type = "S";
			_supervisorType.GetFields(fieldCollection);
		}
		if (_patientType != null)
		{
			_patientType.GetFields(fieldCollection);
		}
		if (_adverseEventAllergyType != null)
		{
			fieldCollection.Add(string.Empty, "Allergy/Adverse Event Information", "H");
			_adverseEventAllergyType.GetFields(fieldCollection);
		}
		if (_medicationType != null)
		{
			fieldCollection.Add(string.Empty, "Drug Information", "H");
			_medicationType.GetFields(fieldCollection);
		}
		if (_observationType != null)
		{
			fieldCollection.Add(string.Empty, "Observation Information", "H");
			_observationType.GetFields(fieldCollection);
		}
		if (_benefitCoordinationTypes != null && _benefitCoordinationTypes.Any())
		{
			foreach (BenefitsCoordinationType benefitCoordinationType in _benefitCoordinationTypes)
			{
				fieldCollection.Add(string.Empty, "Benefits Coordination Information", "H");
				benefitCoordinationType.GetFields(fieldCollection);
			}
		}
		if (_followUpPrescriberType != null)
		{
			_followUpPrescriberType.Type = "F";
			_followUpPrescriberType.GetFields(fieldCollection);
		}
		fieldCollection.Add(string.Empty, "Message Information", "H");
		fieldCollection.Add("Message Type", _xmlMessage.MessageType);
		fieldCollection.Add("Message ID", _xmlMessage.MessageID);
		fieldCollection.Add("Message Date/Time", _xmlMessage.SentTime);
		fieldCollection.Add("Sender ID", _xmlMessage.Sender.Address);
		if (_xmlMessage.SenderSoftware != null)
		{
			if (!string.IsNullOrEmpty(_xmlMessage.SenderSoftware.SenderSoftwareDeveloper))
			{
				fieldCollection.Add("Sender Software Developer", _xmlMessage.SenderSoftware.SenderSoftwareDeveloper);
			}
			if (!string.IsNullOrEmpty(_xmlMessage.SenderSoftware.SenderSoftwareProduct))
			{
				fieldCollection.Add("Sender Software Product", _xmlMessage.SenderSoftware.SenderSoftwareProduct);
			}
			if (!string.IsNullOrEmpty(_xmlMessage.SenderSoftware.SenderSoftwareVersionRelease))
			{
				fieldCollection.Add("Sender Software Version", _xmlMessage.SenderSoftware.SenderSoftwareVersionRelease);
			}
		}
		if (!string.IsNullOrWhiteSpace(_xmlMessage.PrescriberOrderNumber))
		{
			fieldCollection.Add("Prescriber Order Number", _xmlMessage.PrescriberOrderNumber);
		}
		return fieldCollection;
	}
}
