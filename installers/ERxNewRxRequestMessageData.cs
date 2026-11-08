using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using SoftWriters.FrameworkLtc.Models.Patient;

namespace SoftWriters.FrameworkLtc.Models.ERx;

[ExcludeFromCodeCoverage]
public class ERxNewRxRequestMessageData
{
	public bool IsACompound { get; set; }

	public string NDC { get; set; }

	public string DrugName { get; set; }

	public string Strength { get; set; }

	public string GPI { get; set; }

	public string DAW { get; set; }

	public string PhNPI { get; set; }

	public string SPI { get; set; }

	public string MsgSig { get; set; }

	public double Qty { get; set; }

	public string QuantityQualifier { get; set; }

	public int Days { get; set; }

	public bool ProfileOnly { get; set; }

	public string AssocDxType { get; set; }

	public string AssocDx { get; set; }

	public string DateWritten { get; set; }

	public string StartDate { get; set; }

	public string StopDate { get; set; }

	public string EffectiveDate { get; set; }

	public int Refills { get; set; }

	public string RxFillIndicator { get; set; }

	public string ProhibitRenewalRequest { get; set; }

	public string PrescriberOrderNumber { get; set; }

	public string PrescriberLastName { get; set; }

	public string PrescriberFirstName { get; set; }

	public string PrescriberStreetAddress { get; set; }

	public string PrescriberCity { get; set; }

	public string PrescriberState { get; set; }

	public string PrescriberZip { get; set; }

	public string PrescriberDEA { get; set; }

	public string PrescriberStateLicenseNo { get; set; }

	public string PrescriberPhone { get; set; }

	public string PrescriberFax { get; set; }

	public string PrescriberEmail { get; set; }

	public string PrescriberAgentName { get; set; }

	public string Notes { get; set; }

	public List<AdminTimeModelBase> RxAdminTimes { get; set; }

	public bool IsHouseStock { get; set; }

	public bool SequentialSigs { get; set; }

	public List<string> RxDirections { get; set; }
}
