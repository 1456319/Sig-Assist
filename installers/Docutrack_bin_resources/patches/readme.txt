SQL Patches
=======================================================================================================
* The SQL name should correspond to the related story or defect in Version One. Example, D-01234.sql.
* Update the patch manifest to run the added SQL script.
* SQL scripts MUST be safe to run multiple times. For example, check for existence of a column
	before blindly adding it, et.al..