SET NUMERIC_ROUNDABORT OFF 
GO 
SET ANSI_PADDING, ANSI_WARNINGS, CONCAT_NULL_YIELDS_NULL, ANSI_NULLS, ARITHABORT, QUOTED_IDENTIFIER, NOCOUNT ON
GO
BEGIN TRY

	if (_PATCH-VERSION_ > 0)	-- keeps the installer from adding this record when no patches
	begin	
		insert into dbo.PatchHistory (InstallVersion, PatchVersion, ActivityDateTime, ComputerName, ExecutionMethod, ExecutionStatus)
			select '_PRODUCT-VERSION_', _PATCH-VERSION_, GETUTCDATE(), '_COMPUTER-NAME_', '_PATCH-METHOD_', '_PATCH-STATUS_'
	end

END TRY
BEGIN CATCH
	declare @errMsg		varchar(1024)  set @errMsg = error_message()
	IF XACT_STATE() <> 0 ROLLBACK TRAN 	
	RAISERROR (@errMsg, 16, 1) 
END CATCH
