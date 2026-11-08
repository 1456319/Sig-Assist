namespace SoftWriters.FrameworkLtc.ViewModels.Facility.PatientRxHistory;

public class ERxDataItemViewModel : LtcViewModelBase<ERxDataItemViewModel>
{
	public virtual string Title { get; set; }

	public virtual string Value { get; set; }

	public virtual bool IsGroupHeader { get; set; }

	public virtual bool IsHighlighted { get; set; }

	public virtual bool IsRed { get; set; }

	public virtual bool IsGreen { get; set; }

	public virtual bool IsAlternatingBlue { get; set; }

	public virtual bool IsEvenRow { get; set; }
}
