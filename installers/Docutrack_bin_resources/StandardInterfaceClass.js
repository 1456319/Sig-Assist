// ---------------------------------------------------------------------------------
//
// Standard Interface Class
//
// This file contains all objects required for the Standard Interface.
// This includes Extensions to the String class as well as definitions of
// CScreenCollection and the following Screen classes:
//
//	CRxScreen
//	CPatientScreen
//	CFacilityScreen
//	CPhysicianScreen
//
// It is required that the following objects be created in the global scope
// prior to evaluating this code:
//
// goLog (Logging Engine)
// goActions (Client Interface)
// gsInterfaceType (Interface Type)
//
// ---------------------------------------------------------------------------------


//------------------------------------------------------------------------------------
// Extensions to the string class.
//------------------------------------------------------------------------------------
String.prototype.rtrim	= function()		{ return this.replace(/(\s*$)/g, ""); }
String.prototype.ltrim	= function()		{ return this.replace(/(^\s*)/g, ""); }
String.prototype.trim	= function()		{ return this.rtrim().ltrim(); }
String.prototype.left	= function(nCount)	{ return this.substr(0, nCount); }
String.prototype.right	= function(nCount)	{ return this.substr(this.length - nCount, nCount); }
String.prototype.format = function()
{
	try
	{
	// Routine will replace %s and %d within a string with argv variables
	var sReturn			= this;
	var rxMatch			= new RegExp("%s|%d", "m");
	var nArg			= 0;
	
	while (sReturn.search(rxMatch) != -1)
	{
		sReturn = sReturn.replace(rxMatch, nArg < arguments.length ? arguments[nArg] : "(Undefined)");
		++nArg;
	}

	return sReturn;
	}
	catch(oEx)
	{
	return "(ERROR)";
	}
}

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//
// Class: IntegraLogger
//
// Encapsulates all logging away from the actual implementation.  Should be used
// when logging information from script.
//
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
function IntegraLogger(scriptName, functionName)
{
	//***** All items in this class are private!
	//----- Log Levels
	this._Debug			= 0;
	this._Trace			= 1;
	this._Verbose		= 2;
	this._Diagnostic	= 3;
	this._Audit			= 4;
	this._Information	= 5;
	this._Warning		= 6;
	this._Exception		= 7;
	this._Assertion		= 8;
	this._Error			= 9;	

	//----- Constructor
	this._logger		= new ActiveXObject("IS.WM.Architecture.Log");
	this._scriptName	= new String(scriptName);
	this._functionName	= new String(functionName);
}
IntegraLogger.prototype.SetFunctionName	= function(functionName) { this._functionName = functionName; }

IntegraLogger.prototype.Debug		= function(message) { this._logger.DebugLog(this._scriptName, this._functionName, message); }
IntegraLogger.prototype.Trace		= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Trace, message); }
IntegraLogger.prototype.Verbose		= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Verbose, message); }
IntegraLogger.prototype.Diagnostic	= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Diagnostic, message); }
IntegraLogger.prototype.Audit		= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Audit, message); }
IntegraLogger.prototype.Information	= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Information, message); }
IntegraLogger.prototype.Warning		= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Warning, message); }
IntegraLogger.prototype.Exception	= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Exception, message); }
IntegraLogger.prototype.Assertion	= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Assertion, message); }
IntegraLogger.prototype.Error		= function(message) { this._logger.WriteLog(this._scriptName, this._functionName, this._Error, message); }


// Main flow
var goLog = new IntegraLogger("StandardInterfaceClass.js", "CreateUsedCOMObjects");


// ---------------------------------------------------------------------------------
// Global Constants to all Screen Classes
// ---------------------------------------------------------------------------------

// Dialog box constants
var ksMessageBoxTitle		= "DocuTrack";
var ksDocumentReadOnly		= "The loaded document is read-only.";
var ksDocumentNotLoaded		= "A document must be loaded to associate.";
var ksDocutrackBusy			= "DocuTrack client/server is currently busy. Please try again.";
var ksErrorIncorrectScreen	= "The application is in the incorrect screen or there is not enough data available in the screen for DocuTrack to recognize.";
var ksAboutDialog			= "DocuTrack Interface.\r\n\r\nHotkeys:\r\n\t^A\tAssociate entity to current document.\r\n\t^S\tDocuTrack Search.\r\n\t^I\tShow the Interface About box.";

var kiMessageBoxNice		= 4160;
var kiMessageBoxFirm		= 4144;
var kiMessageBoxError		= 4112;
var kiMessageBoxQuestion	= 4132;

// Objects to create
var ksDocumentEngine		= "DCIDocument.DocumentEngine";
var ksTokenCollection		= "DTClientInterface.DTTokenCollection";

// DCI Constants
var DCI_FILTER_RX_ID_1			= 1;
var DCI_FILTER_RX_ID_2			= 2;
var DCI_FILTER_PATIENT_ID_1		= 3;
var DCI_FILTER_PATIENT_ID_2		= 4;
var DCI_FILTER_FACILITY_ID_1	= 5;
var DCI_FILTER_FACILITY_ID_2	= 6;
var DCI_FILTER_PHYSICIAN_ID_1	= 7;
var DCI_FILTER_PHYSICIAN_ID_2	= 8;
var DCI_FILTER_MANIFEST_ID_1	= 9;
var DCI_FILTER_MANIFEST_ID_2	= 10;
var DCI_FILTER_ANCILLARY_ID_1	= 11;
var DCI_FILTER_ANCILLARY_ID_2   = 12;
var DCI_FILTER_RX_ID_3          = 13;
var DCI_FILTER_RX_ID_4          = 14;

var kiDCIFieldLockType			= 12;

var	E_DCI_BASE_ERROR		    	= -2147220992;			            	//0x80040200;
var	E_DCI_BASE_ERROR_MAX			= E_DCI_BASE_ERROR + 255;				//0x800402FF (-2147220737);

var E_NOTIMPL					= -2147467263;


// ----------------------------------------------------------------------------
// CEntityData
//
// This object represents the attribute for the entity XML node
// ----------------------------------------------------------------------------
function CEntityData(sAttribute, sValue)
{
	this._sAttribute = new String(sAttribute);
	this._sValue = new String(sValue);
}

// ----------------------------------------------------------------------------
// CEntityDataCollection
//
// Internal class which holds an array of entity attributes.
// This collection of information makes up the entity XML node.
//
// Please note that the entity type variable will be used to create the XML node for this entity.
// ----------------------------------------------------------------------------
function CEntityDataCollection(sEntityType)
{
	this._sEntityType = new String(sEntityType.trim());
	this._oEntityDataCollection = new Array();
	
	
	// Function for adding entity data objects to a specific entity type collection
	this.AddEntityData = function(oEntityData)
	{
		this._oEntityDataCollection.push(oEntityData);
	}
}


// ---------------------------------------------------------------------------------
// CScreenCollection - Class that encapsulates a Screen Collection
// 
// Public Methods:
//
// void AddScreen (object)
// void Associate()
// void LoadQ()
// void AboutDialog(sCustomMessage)
// ---------------------------------------------------------------------------------
function CScreenCollection(sKeysToSend)
{	
	// ----------------------------------------------------------------------------
	// Initialization
	// ----------------------------------------------------------------------------
	this._sKeystrokes = sKeysToSend;
	
	// ----------------------------------------------------------------------------
	// Shows the error message to the user.
	// ----------------------------------------------------------------------------
	this.DisplayDCIException = function(exception)
	{
		// Handle defined exceptions here, throw back to caller if not defined.
		if(exception.number >= E_DCI_BASE_ERROR && exception.number <= E_DCI_BASE_ERROR_MAX)
		{
			goActions.DisplayMessage(ksMessageBoxTitle, exception.description, kiMessageBoxFirm);
		}
		else
		{			
			goActions.DisplayMessage(ksMessageBoxTitle, "An unexpected error occurred. Error details: " + exception.description, kiMessageBoxFirm);
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// AboutDialog - Displays Interface About Dialog
	// If sCustomMessage is not passed the default message will be used.
	// ----------------------------------------------------------------------------
	this.AboutDialog = function(sCustomMessage)
	{
		goLog.Verbose("Displaying Interface About box.");
		
		if ((null == sCustomMessage) || (sCustomMessage.length == 0))
			sCustomMessage = ksAboutDialog;
		
		goActions.DisplayMessage(ksMessageBoxTitle, sCustomMessage, kiMessageBoxNice);
	}
	
	
	// ----------------------------------------------------------------------------
	// AddScreen - Adds a *Screen object to the Screen Collection
	// ----------------------------------------------------------------------------
	this.AddScreen = function(oScreen)
	{
		goLog.Verbose("Adding screen '" + oScreen.GetName() + "' to collection.");
		
		// Add screen to private array
		this._aoScreens.push(oScreen);
	}
	
	
	// ----------------------------------------------------------------------------
	// AddEntity - Adds a specific entity type complete with entity data to a more global array.
	//				This allows for multiple entities of same or different types to
	//				be associated in one call.
	//	Sample structure: _aoEntities
	//							RX
	//								UniqueID
	//							RX
	//								UniqueID
	//								MedicationName
	//							Facility
	//								UniqueID
	//								Name
	// ----------------------------------------------------------------------------
	this.AddEntity = function(oEntityDataCollection)
	{
		// Add the data to our private array for use later when creating xml
		this._aoEntities.push(oEntityDataCollection);
	}
	
	
	// ----------------------------------------------------------------------------
	// Associate -- Capture clipboard, Determine Screen, Associate Document
	// ----------------------------------------------------------------------------
	this.Associate = function()
	{
		goLog.Verbose("Entering CScreenCollection.Associate");
		
		try
		{
			with (this)
			{
				// Retrieve Clipboard Contents
				var sClipData = _CaptureClipboard();
				
				// Determine if we have a screen matched, if so -- call Associate()
				var oScreen = _RecognizeScreen(sClipData);
				
				if (oScreen != null)
					oScreen.Associate();
			}
		}
		catch(oEx)
		{
			goLog.Error("CScreenCollection.Associate Error: " + oEx.description);
            DisplayDCIException(oEx);
			
			// throw to the outside handler as well.
			throw oEx;
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQ -- Capture clipboard, Determine Screen, Load Document List
	// ----------------------------------------------------------------------------
	this.LoadQueue = function()
	{
		goLog.Verbose("Entering CScreenCollection.LoadQueue");
		
		try
		{
			with (this)
			{
				// Retrieve Clipboard Contents
				var sClipData = _CaptureClipboard();
				
				// Determine if we have a screen matched, if so -- call LoadQ()
				var oScreen = _RecognizeScreen(sClipData);
				
				if (oScreen != null)
					oScreen.LoadQueue();
			}
		}
		catch(oEx)
		{
			goLog.Error("CScreenCollection.LoadQueue Error: " + oEx.description);
            DisplayDCIException(oEx);			

			// throw to the outside handler as well.
			throw oEx;
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQueueFromValue -- The screen has already been recognized and the specific data to search on
	// 				will be passed directly to this function along with the type of filter to use.
	//				(Filter types are declared as constants at the top.)
	// ----------------------------------------------------------------------------
	this.LoadQueueFromValue = function(iEntityType, sEntityID)
	{
		goLog.Verbose("Entering CScreenCollection.LoadQueueFromValue");
		
		try
		{
			with (this)
			{
				// Create Document Engine, DCIEntities object, and a container for this entity
				var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
				
				// Register the interface
				oDocumentEngine.Register(gsInterfaceType);
				
				// Load Document List
				oDocumentEngine.LoadDocumentList(iEntityType, sEntityID);
				
				// Unregister the interface
				oDocumentEngine.Unregister();
			}
		}
		catch( oError )
		{
			goLog.Error("CScreenCollection.LoadQueue exception: " + oError.number + " -- " + oError.description);
			throw oError;
		}
		
	}
	
	
	// ----------------------------------------------------------------------------
	// CaptureClipboard -- Sends keys required and returns clipboard contents.
	// ----------------------------------------------------------------------------
	this._CaptureClipboard = function()
	{
		goLog.Verbose("Entering CScreenCollection._CaptureClipboard");
		
		var s = null;
		with (this)
		{
			try
			{	
				if ((_sKeystrokes != null) && (_sKeystrokes.length > 0))
					_SendKeys(_sKeystrokes);
				
				s = goActions.GetInterfaceData();
			}
			catch(oEx)
			{
				goLog.Error("CScreenCollection._CaptureClipboard exception: " + oEx.number + " -- " + oEx.description);
				throw oEx;
			}
		}
		goLog.Verbose("Clipboard Contents:\n" + s);
		
		return s;
	}
	
	
	// ----------------------------------------------------------------------------
	// RecognizeScreen - Loop through each screen and check if we are in it.
	// if a match is found, return the screen object otherwise return null
	// ----------------------------------------------------------------------------
	this._RecognizeScreen = function(sScreenData)
	{
		goLog.Verbose("Entering CScreenCollection._RecognizeScreen");
		
		var bScreenFound	= false;
		var oCurrentScreen	= null;
		with (this)
		{
			// Traverse each screen in array
			for (var i = 0; i < _aoScreens.length; i++)
			{
				try
				{
					// If a match is found, mark as so and break the loop.
					if (_aoScreens[i].ParseScreenData(sScreenData))
					{
						oCurrentScreen = _aoScreens[i];
						goLog.Verbose("Screen match found: %s.".format(oCurrentScreen.GetName()));
						break;
					}
				}
				catch(oEx)
				{
					goLog.Error("Error in CScreenCollection._RecognizeScreen: " + oEx.description);
				}
			}
			
			// If no match has been found, we log invalid screen and exit.
			if (null == oCurrentScreen)
			{
				goLog.Information(ksErrorIncorrectScreen);
				return;
			}
		}
		
		// A match has been found, return the screen.
		return oCurrentScreen;
	}
	
	
	// ----------------------------------------------------------------------------
	// SendKeys -- Send keystrokes to the client
	// ----------------------------------------------------------------------------	
	this._SendKeys = function(sKeys)
	{
		if ((sKeys != null) && (sKeys.length > 0))
		{
			var sSafeKeys = sKeys.replace(/%/g, "%%");
			goLog.Verbose("Sending: " + sSafeKeys);
			goActions.SendKeys(sKeys);
		}
	}
	
	// ----------------------------------------------------------------------------
	// AssociateEntityData -- Given a collection of entity data we need to create
	// valid DirectConnect XML and send it across the wire.
	// ----------------------------------------------------------------------------
	this.AssociateEntityData = function()
	{
		goLog.Verbose("Entering CScreenCollection.AssociateEntityData");

		// Register the interface
		var oDocumentEngine = new ActiveXObject(ksDocumentEngine);
		oDocumentEngine.Register(gsInterfaceType);

		// see if a document is loaded
		var bIsDocLoaded = oDocumentEngine.IsDocumentLoaded();

		// make sure there is a document loaded.
		if (!bIsDocLoaded) {
		    goLog.Error("CScreenCollection.AssociateEntityData Error: %s".format(ksDocumentNotLoaded));
		    goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
		    return;
		}

		var currentDocStatus = oDocumentEngine.GetDocumentData(kiDCIFieldLockType);

		// make sure the document is not locked.
		if (currentDocStatus == "readonly") {
		    goLog.Error("CScreenCollection.AssociateEntityData Error: %s".format(ksDocumentReadOnly));
		    goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
		    return;
		}
		
		with (this) 
        {
		    // Create DCIEntities object and a container for the association data
		    var oDCIEntities = new CDCIEntities();
		    var oEntityXML = oDCIEntities.getNewObject();

            var oEntityData	= null; // This is a specific entity array containing attributes and values
            with (this)
            {
				// This will give us access to the nodes of the main xml document
				with ( oEntityXML )
				{
					with (this)
					{
						// Traverse each entity object in the array and create an xml node for this entity
						for (var i = 0; i < _aoEntities.length; i++)
						{
							oEntityData = _aoEntities[i];
							
							var newNode = _xmlDoc.createElement( oEntityData._sEntityType );
							newNode.setAttribute( ksAssociate, 1 );
							newNode.setAttribute( ksPharmacyUniqueId, "" );
							newNode.setAttribute( ksLicenseType, gsInterfaceType );
					
							for(var iAttributes = 0; iAttributes < oEntityData._oEntityDataCollection.length; iAttributes++)
							{	
								newNode.setAttribute( oEntityData._oEntityDataCollection[iAttributes]._sAttribute, oEntityData._oEntityDataCollection[iAttributes]._sValue );
							}
							
							// Note the trim statements here are due to a JavaScript issue with string comparisons.
							switch(oEntityData._sEntityType.trim())
							{
								case ksRX.trim():
									_RXs.appendChild( newNode );
									break;
								case ksFacility.trim():
									_Facilities.appendChild( newNode );
									break;
								case ksAncillary.trim():
									_Ancillaries.appendChild( newNode );
									break;
								case ksManifest.trim():
									_Manifests.appendChild( newNode );
									break;
								case ksPatient.trim():
									_Patients.appendChild( newNode );
									break;
								case ksPhysician.trim():
									_Physicians.appendChild( newNode );
									break;
							}
							
							oEntityData = null; // Cleaning house just for good measure
						}
					}
				}	
				
			}
		
			oDocumentEngine.AssociateEntities(oEntityXML.toString());
        }
        // Unregister the interface
        oDocumentEngine.Unregister();
	}
	
	// ----------------------------------------------------------------------------
	// AssociateAll -- Instead of doing the association for each individual screen
	// 					we want to build the xml to include all screens and send it
	// 					across in one call.
	// ----------------------------------------------------------------------------
	this.AssociateAllScreens = function()
	{
		goLog.Verbose("Entering CScreenCollection.AssociateAllScreens");

		// Register the interface
		var oDocumentEngine = new ActiveXObject(ksDocumentEngine);
		oDocumentEngine.Register(gsInterfaceType);

		// see if a document is loaded
		var bIsDocLoaded = oDocumentEngine.IsDocumentLoaded();

		// make sure there is a document loaded.
		if (!bIsDocLoaded) {
		    goLog.Error("CScreenCollection._AssociateAllScreens Error: %s".format(ksDocumentNotLoaded));
		    goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
		    return;
		}

		var currentDocStatus = oDocumentEngine.GetDocumentData(kiDCIFieldLockType);

		// make sure the document is not locked.
		if (currentDocStatus == "readonly") {
		    goLog.Error("CScreenCollection._AssociateAllScreens Error: %s".format(ksDocumentReadOnly));
		    goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
		    return;
		}

		with (this) 
        {
		    // Create DCIEntities object and a container for this entity
		    var oDCIEntities = new CDCIEntities();
		    var oEntity = oDCIEntities.getNewObject();

            var oCurrentScreen	= null;
            with (this)
            {
	            // Traverse each screen in array
	            for (var i = 0; i < _aoScreens.length; i++)
	            {
                    if(_aoScreens[i] != null)
                    {
                        oCurrentScreen = _aoScreens[i];
                        with(oCurrentScreen)
                        {
			                // require unique id for association
			                if ((_entity_uniqueId != null ) && (_entity_uniqueId.length > 0))
			                {
				                // Create the entity XML
				                // This switch statement only works if the screen names are zero length or null
			                    // and therefore the GetName function returns the class name.
                                switch(GetName())
                                {
                                    case "CRxScreen":
                                        // Create the entity XML
                                        oEntity.addRxEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_patientUniqueID, _entity_facilityUniqueID, _entity_refill, gsInterfaceType, _entity_physicianID, _entity_dtWritten, _entity_dtDispensed, _entity_drugName);
                                        break;
                                    case "CFacilityScreen":
                                        oEntity.addFacilityEntity(true, "", _entity_uniqueId, _entity_facilityName, _entity_secondaryID, gsInterfaceType);
                                        break;
                                    case "CPatientScreen":
                                        oEntity.addPatientEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_facilityUniqueID, _entity_location, _entity_secondaryID, _entity_dateOfBirth, gsInterfaceType);
                				        break;
                				    case "CPhysicianScreen":
                				        oEntity.addPhysicianEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_secondaryID, gsInterfaceType);
                                        break;
                                }          
				                
			                }
			                else
			                {
				                goLog.Information(ksErrorIncorrectScreen);
			                }
                        }
                    }
                }
            }

            // Associate the entities
            oDocumentEngine.AssociateEntities(oEntity.toString());
        }
        // Unregister the interface
        oDocumentEngine.Unregister();
    }



	
	// ----------------------------------------------------------------------------
	// Private Data
	// ----------------------------------------------------------------------------
	this._aoScreens = new Array();
	this._aoEntities = new Array();
}


// ---------------------------------------------------------------------------------
// CPatientScreen - Class that encapsulates a Rx Screen
//
// Public Methods:
//	bool	ParseScreenData(clipdata) -- return true if screen is a match to clipdata
//	void	Associate()	-- associate entity, logs and displays a message on error
//	void	LoadQueue() -- load queue based on current entity, logs and displays on error
//
// Methods for setting regular expressions:
//			SetScreenValidation
//			SetUniqueID
//			SetFirstName
//			SetLastName
//			SetFullName
//			SetSecondaryID
//			SetFacilityUniqueID
//			SetDateOfBirth
//
// ---------------------------------------------------------------------------------
function CPatientScreen(sScreenName)
{	
	goLog.Verbose("Initializing CPatientScreen Object.");

	// ----------------------------------------------------------------------------
	// Constructor Logic performed here
	// ----------------------------------------------------------------------------
	this._oTokens		= new ActiveXObject(ksTokenCollection);
	this._sScreenName	= sScreenName;
	
	// Interface type must be defined globally, if not throw
	if (gsInterfaceType == null)
		throw new Error("No interface type specified.");

	// ----------------------------------------------------------------------------
	// GetName - Retrieve the name of this Screen (for Verbose Logging / Debugging)
	// ----------------------------------------------------------------------------
	this.GetName = function()
	{
		if ((null == sScreenName) || (sScreenName.length == 0))
			return "CPatientScreen";
		else
			return this._sScreenName;
	}
	
	// ----------------------------------------------------------------------------
	// SetScreenValidation - Sets the regular expression that determines if the
	//						 clipboard contents match this screen.
	// ----------------------------------------------------------------------------
	this.SetScreenValidation = function(sRegEx)
	{
		this._oTokens.AddToken("%CorrectScreen%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetUniqueID - Sets the regular expression that will extract the UniqueID
	// ----------------------------------------------------------------------------
	this.SetUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%uniqueID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFirstName - Sets the regular expression that will extract the first name
	// ----------------------------------------------------------------------------
	this.SetFirstName = function(sRegEx)
	{
		this._oTokens.AddToken("%firstName%", sRegEx, "");
	}
	

	// ----------------------------------------------------------------------------
	// SetLastName - Sets the regular expression that will extract the last name
	// ----------------------------------------------------------------------------
	this.SetLastName = function(sRegEx)
	{
		this._oTokens.AddToken("%lastName%", sRegEx, "");
	}	
	

	// ----------------------------------------------------------------------------
	// SetFullName - Sets the regular expression that will extract the full name
	// ----------------------------------------------------------------------------	
	this.SetFullName = function(sRegEx)
	{
		this._oTokens.AddToken("%fullName%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetSecondaryID - Sets the regular expression that will extract the
	//					  - secondaryID field.
	// ----------------------------------------------------------------------------		
	this.SetSecondaryID = function(sRegEx)
	{
		this._oTokens.AddToken("%secondaryID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFacilityUniqueID - Sets the regular expression that will extract the
	//					   - FacilityUniqueID field.
	// ----------------------------------------------------------------------------		
	this.SetFacilityUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%facilityUniqueID%", sRegEx, "");
	}	
	

	// ----------------------------------------------------------------------------
	// SetDateOfBirth - Sets the regular expression that will extract the
	//				  - dateOfBirth
	// ----------------------------------------------------------------------------		
	this.SetDateOfBirth = function(sRegEx)
	{
		this._oTokens.AddToken("%dateOfBirth%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetLocation - Sets the regular expression that will extract the
	//			   - Drug name
	// ----------------------------------------------------------------------------		
	this.SetLocation = function(sRegEx)
	{
		this._oTokens.AddToken("%location%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// ParseScreenData -- tests this screen and grabs any data it can. returns true
	// if this screen is a match.
	// ----------------------------------------------------------------------------	
	this.ParseScreenData = function(sScreenData)
	{
		goLog.Verbose("Entering CPatientScreen.ParseScreenData");
		
		var bReturn = false;
		
		if (true == this._oTokens.TestValue("%CorrectScreen%", sScreenData))
		{
			this._oTokens.UpdateCollectionViaParse(sScreenData, true);
			
			// Mark this screen has validated
			bReturn = true;	
			with(this)
			{
				_entity_uniqueId			= _oTokens.GetValue("%uniqueID%").trim();
				_entity_firstName			= _oTokens.GetValue("%firstName%").trim();
				_entity_lastName			= _oTokens.GetValue("%lastName%").trim();
				_entity_fullName			= _oTokens.GetValue("%fullName%").trim();
				_entity_secondaryID			= _oTokens.GetValue("%secondaryID%").trim();
				_entity_facilityUniqueID	= _oTokens.GetValue("%facilityUniqueID%").trim();
				_entity_dateOfBirth			= _oTokens.GetValue("%dateOfBirth%").trim();
				_entity_location			= _oTokens.GetValue("%location%").trim();
				
				goLog.Verbose("UniqueID: %s".format(_entity_uniqueId));
				goLog.Verbose("FirstName: %s".format(_entity_firstName));
				goLog.Verbose("LastName: %s".format(_entity_lastName));
				goLog.Verbose("FullName: %s".format(_entity_fullName));
				goLog.Verbose("Secondary Id: %s".format(_entity_secondaryID));
				goLog.Verbose("FacilityUniqueID: %s".format(_entity_facilityUniqueID));
				goLog.Verbose("Date of Birth: %s".format(_entity_dateOfBirth));
				goLog.Verbose("Location: %s".format(_entity_location));
			}
		}
		return bReturn;
	}


	// ----------------------------------------------------------------------------
	// Associate - Call to associate -- executes OnBefore, _Associate, and OnAfter
	// ----------------------------------------------------------------------------
	this.Associate = function()
	{
		goLog.Verbose("Entering CPatientScreen.Associate");
		with (this)
		{
			if (true == OnBeforeAssociate())
			{
				_Associate();
				OnAfterAssociate();
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQueue - Call to Load a Q based on information in the current screen
	// ----------------------------------------------------------------------------
	this.LoadQueue = function()
	{
		goLog.Verbose("Entering CPatientScreen.LoadQueue");
		with(this)
		{
			if (true == OnBeforeLoadQueue())
			{
				_LoadQueue();
				OnAfterLoadQueue();
			}
		}
	}	


	// ----------------------------------------------------------------------------
	// _LoadQueue - private method that Loads a Q based on the current PID/MRN
	// ----------------------------------------------------------------------------	
	this._LoadQueue = function()
	{
		with (this)
		{
			var iEntityType, sEntityID;
			
			// Create Document Engine, DCIEntities object, and a container for this entity
			var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
			
			// Register the interface
			oDocumentEngine.Register(gsInterfaceType);
			
			// If Patient ID exists -- use it, else use RX ID
			if ((_entity_secondaryID != null) && (_entity_secondaryID.length > 0))
			{
				iEntityType	= DCI_FILTER_PATIENT_ID_2;
				sEntityID	= _entity_secondaryID;
			}
			else
			{
				iEntityType = DCI_FILTER_PATIENT_ID_1;
				sEntityID	= _entity_uniqueId;
			}
			
			// Load Document List
			oDocumentEngine.LoadDocumentList(iEntityType, sEntityID);
			
			// Unregister the interface
			oDocumentEngine.Unregister();
		}
	}	


	// ----------------------------------------------------------------------------
	// Associate - private method that Associates the current screen via DCEntities
	// ----------------------------------------------------------------------------	
	this._Associate = function()
	{
		with (this)
		{
			// require unique id for association
			if ((_entity_uniqueId != null ) && (_entity_uniqueId.length > 0))
			{
				// Register the interface
				var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
				oDocumentEngine.Register(gsInterfaceType);
				
				// see if a document is loaded
				var bIsDocLoaded	= oDocumentEngine.IsDocumentLoaded();

				// make sure there is a document loaded.
				if (!bIsDocLoaded)
				{
					goLog.Error("CPatientScreen._Associate Error: %s".format(ksDocumentNotLoaded));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
					return;
				}	

				var currentDocStatus = oDocumentEngine.GetDocumentData( kiDCIFieldLockType );
				
				// make sure the document is not locked.
				if ( currentDocStatus == "readonly" )
				{
					goLog.Error("CPatientScreen._Associate Error: %s".format(ksDocumentReadOnly));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
					return;
				}
				
				// Properly handle name fields.
				_FormatName();
	
				// Create DCIEntities object and a container for this entity
				var oDCIEntities	= new CDCIEntities();
				var oEntity			= oDCIEntities.getNewObject();
				
				// Create the entity XML
				oEntity.addPatientEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_facilityUniqueID, _entity_location, _entity_secondaryID, _entity_dateOfBirth, gsInterfaceType);
				
				// Associate the Rx
				oDocumentEngine.AssociateEntities(oEntity.toString());
				
				// Unregister the interface
				oDocumentEngine.Unregister();
			}
			else
			{
				goLog.Information(ksErrorIncorrectScreen);
			}
		}
	}


	// ----------------------------------------------------------------------------
	// _FormatName - Properly format name fields.
	// If full name exists, that means we did not have discrete regular expressions
	// for first name / last name.  We search for the first comma, if no comma exists
	// then the full name will become the last name.  If a comma exists, everything
	// to the left will be last name, everything to the right will be first name.
	// ----------------------------------------------------------------------------		
	this._FormatName = function()
	{
		with (this)
		{
			// If full name is not populated, use first/last
			if (_entity_fullName.length > 0)
			{
				// Determine if theres a , in the name.
				var iBreak = _entity_fullName.indexOf(",");
								
				if (iBreak >= 0)
				{
					_entity_lastName 	= _entity_fullName.substring(0, iBreak).trim();
					_entity_firstName	= _entity_fullName.substring(iBreak+1, _entity_fullName.length).trim();
					
					// Dont allow zero length last names, swap with first name.
					if (_entity_lastName.length == 0)
					{
						_entity_lastName = _entity_firstName;
						_entity_firstName = "";
					}
				}
				else
				{
					_entity_lastName	= _entity_fullName;
					_entity_firstName	= "";
				}
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// OnBeforeAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations before Associate(). If this
	//						 returns false then Associate() and OnAfterAssociate()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeAssociate = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations after Associate()
	// ----------------------------------------------------------------------------
	this.OnAfterAssociate = function() { return; };

	
	// ----------------------------------------------------------------------------
	// OnBeforeLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations before LoadQueue(). If this
	//						 returns false then LoadQueue() and OnBeforeLoadQueue()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeLoadQueue = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations after LoadQueue()
	// ----------------------------------------------------------------------------
	this.OnAfterLoadQueue = function() { return; };

	
	// ----------------------------------------------------------------------------
	// Private Entity-Specific Data
	// ----------------------------------------------------------------------------
	this._entity_uniqueId			= null;
	this._entity_firstName			= null;
	this._entity_lastName			= null;
	this._entity_fullName			= null;
	this._entity_secondaryID		= null;
	this._entity_facilityUniqueID	= null;
	this._entity_dateOfBirth		= null;
	this._entity_location			= null;
	
}


// ---------------------------------------------------------------------------------
// CRxScreen - Class that encapsulates a Rx Screen
//
// Public Methods:
//	bool	ParseScreenData(clipdata) -- return true if screen is a match to clipdata
//	void	Associate()	-- associate entity, logs and displays a message on error
//	void	LoadQueue() -- load queue based on current entity, logs and displays on error
//
// Methods for setting regular expressions:
//			SetScreenValidation
//			SetUniqueID
//			SetFirstName
//			SetLastName
//			SetFullName
//			SetPatientUniqueID
//			SetFacilityUniqueID
//			SetRefill
//			SetLicenseType
//			SetPhysicianID
//			SetDateWritten
//			SetDateDispensed
//			SetDrugName
//
// ---------------------------------------------------------------------------------
function CRxScreen(sScreenName)
{	
	goLog.Verbose("Initializing CRxScreen Object.");

	// ----------------------------------------------------------------------------
	// Constructor Logic performed here
	// ----------------------------------------------------------------------------
	this._oTokens		= new ActiveXObject(ksTokenCollection);
	this._sScreenName	= sScreenName;
	
	// Interface type must be defined globally, if not throw
	if (gsInterfaceType == null)
		throw new Error("No interface type specified.");

	// ----------------------------------------------------------------------------
	// GetName - Retrieve the name of this Screen (for Verbose Logging / Debugging)
	// ----------------------------------------------------------------------------
	this.GetName = function()
	{
		if ((null == sScreenName) || (sScreenName.length == 0))
			return "CRxScreen"
		else
			return this._sScreenName;
	}
	
	// ----------------------------------------------------------------------------
	// SetScreenValidation - Sets the regular expression that determines if the
	//						 clipboard contents match this screen.
	// ----------------------------------------------------------------------------
	this.SetScreenValidation = function(sRegEx)
	{
		this._oTokens.AddToken("%CorrectScreen%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetUniqueID - Sets the regular expression that will extract the UniqueID
	// ----------------------------------------------------------------------------
	this.SetUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%uniqueID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFirstName - Sets the regular expression that will extract the first name
	// ----------------------------------------------------------------------------
	this.SetFirstName = function(sRegEx)
	{
		this._oTokens.AddToken("%firstName%", sRegEx, "");
	}
	

	// ----------------------------------------------------------------------------
	// SetLastName - Sets the regular expression that will extract the last name
	// ----------------------------------------------------------------------------
	this.SetLastName = function(sRegEx)
	{
		this._oTokens.AddToken("%lastName%", sRegEx, "");
	}	
	

	// ----------------------------------------------------------------------------
	// SetFullName - Sets the regular expression that will extract the full name
	// ----------------------------------------------------------------------------	
	this.SetFullName = function(sRegEx)
	{
		this._oTokens.AddToken("%fullName%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetPatientUniqueID - Sets the regular expression that will extract the
	//					  - PatientUniqueID field.
	// ----------------------------------------------------------------------------		
	this.SetPatientUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%patientUniqueID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFacilityUniqueID - Sets the regular expression that will extract the
	//					   - FacilityUniqueID field.
	// ----------------------------------------------------------------------------		
	this.SetFacilityUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%facilityUniqueID%", sRegEx, "");
	}	

	
	// ----------------------------------------------------------------------------
	// SetRefill - Sets the regular expression that will extract the refill field.
	// ----------------------------------------------------------------------------		
	this.SetRefill = function(sRegEx)
	{
		this._oTokens.AddToken("%refill%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetPhysicianID - Sets the regular expression that will extract the
	//				  - PhysicianUniqueID
	// ----------------------------------------------------------------------------		
	this.SetPhysicianID = function(sRegEx)
	{
		this._oTokens.AddToken("%physicianID%", sRegEx, "");
	}	
	

	// ----------------------------------------------------------------------------
	// SetDateWritten - Sets the regular expression that will extract the
	//				  - DateWritten
	// ----------------------------------------------------------------------------		
	this.SetDateWritten = function(sRegEx)
	{
		this._oTokens.AddToken("%dateWritten%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetDateDispensed - Sets the regular expression that will extract the
	//				    - DateDispensed
	// ----------------------------------------------------------------------------		
	this.SetDateDispensed = function(sRegEx)
	{
		this._oTokens.AddToken("%dateDispensed%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetDrugName - Sets the regular expression that will extract the
	//			   - Drug name
	// ----------------------------------------------------------------------------		
	this.SetDrugName = function(sRegEx)
	{
		this._oTokens.AddToken("%drugName%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// ParseScreenData -- tests this screen and grabs any data it can. returns true
	// if this screen is a match.
	// ----------------------------------------------------------------------------	
	this.ParseScreenData = function(sScreenData)
	{
		goLog.Verbose("Entering CRxScreen.ParseScreenData");
		
		var bReturn = false;
		
		if (true == this._oTokens.TestValue("%CorrectScreen%", sScreenData))
		{
			this._oTokens.UpdateCollectionViaParse(sScreenData, true);
			
			// Mark this screen has validated
			bReturn = true;	
			with(this)
			{
				_entity_uniqueId			= _oTokens.GetValue("%uniqueID%").trim();
				_entity_firstName			= _oTokens.GetValue("%firstName%").trim();
				_entity_lastName			= _oTokens.GetValue("%lastName%").trim();
				_entity_fullName			= _oTokens.GetValue("%fullName%").trim();
				_entity_patientUniqueID		= _oTokens.GetValue("%patientUniqueID%").trim();
				_entity_facilityUniqueID	= _oTokens.GetValue("%facilityUniqueID%").trim();
				_entity_refill				= _oTokens.GetValue("%refill%").trim();
				_entity_physicianID			= _oTokens.GetValue("%physicianID%").trim();
				_entity_dtWritten			= _oTokens.GetValue("%dateWritten%").trim();
				_entity_dtDispensed			= _oTokens.GetValue("%dateDispensed%").trim();
				_entity_drugName			= _oTokens.GetValue("%drugName%").trim();
				
				goLog.Verbose("UniqueID: %s".format(_entity_uniqueId));
				goLog.Verbose("FirstName: %s".format(_entity_firstName));
				goLog.Verbose("LastName: %s".format(_entity_lastName));
				goLog.Verbose("FullName: %s".format(_entity_fullName));
				goLog.Verbose("PatientUniqueID: %s".format(_entity_patientUniqueID));
				goLog.Verbose("FacilityUniqueID: %s".format(_entity_facilityUniqueID));
				goLog.Verbose("Refill: %s".format(_entity_refill));
				goLog.Verbose("PhysicianID: %s".format(_entity_physicianID));
				goLog.Verbose("DateWritten: %s".format(_entity_dtWritten));
				goLog.Verbose("DateDispensed: %s".format(_entity_dtDispensed));
				goLog.Verbose("DrugName: %s".format(_entity_drugName));
			}
		}
		return bReturn;
	}
	

	// ----------------------------------------------------------------------------
	// Associate - Call to associate -- executes OnBefore, _Associate, and OnAfter
	// ----------------------------------------------------------------------------
	this.Associate = function()
	{
		goLog.Verbose("Entering CRxScreen.Associate");
		with (this)
		{
			if (true == OnBeforeAssociate())
			{
				_Associate();
				OnAfterAssociate();
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQueue - Call to Load a Q based on information in the current screen
	// ----------------------------------------------------------------------------
	this.LoadQueue = function()
	{
		goLog.Verbose("Entering CRxScreen.LoadQueue");
		with(this)
		{
			if (true == OnBeforeLoadQueue())
			{
				_LoadQueue();
				OnAfterLoadQueue();
			}
		}
	}	


	// ----------------------------------------------------------------------------
	// _LoadQueue - private method that Loads a Q based on the current PID/MRN
	// ----------------------------------------------------------------------------	
	this._LoadQueue = function()
	{
		with (this)
		{
			var iEntityType, sEntityID;
			
			// Create Document Engine, DCIEntities object, and a container for this entity
			var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
			
			// Register the interface
			oDocumentEngine.Register(gsInterfaceType);
			
			// If Patient ID exists -- use it, else use RX ID
			if ((_entity_patientUniqueID != null) && (_entity_patientUniqueID.length > 0))
			{
				iEntityType	= DCI_FILTER_RX_ID_2;
				sEntityID	= _entity_patientUniqueID;
			}
			else
			{
				iEntityType = DCI_FILTER_RX_ID_1;
				sEntityID	= _entity_uniqueId;
			}
			
			// Load Document List
			oDocumentEngine.LoadDocumentList(iEntityType, sEntityID);
			
			// Unregister the interface
			oDocumentEngine.Unregister();
		}
	}	


	// ----------------------------------------------------------------------------
	// Associate - private method that Associates the current screen via DCEntities
	// ----------------------------------------------------------------------------	
	this._Associate = function()
	{
		with (this)
		{
			// require unique id for association
			if ((_entity_uniqueId != null ) && (_entity_uniqueId.length > 0))
			{
				// Register the interface
				var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
				oDocumentEngine.Register(gsInterfaceType);
				
				// see if a document is loaded
				var bIsDocLoaded	= oDocumentEngine.IsDocumentLoaded();

				// make sure there is a document loaded.
				if (!bIsDocLoaded)
				{
					goLog.Error("CRxScreen._Associate Error: %s".format(ksDocumentNotLoaded));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
					return;
				}	

				var currentDocStatus = oDocumentEngine.GetDocumentData( kiDCIFieldLockType );
				
				// make sure the document is not locked.
				if ( currentDocStatus == "readonly" )
				{
					goLog.Error("CRxScreen._Associate Error: %s".format(ksDocumentReadOnly));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
					return;
				}
				
				// Properly handle name fields.
				_FormatName();
	
				// Create DCIEntities object and a container for this entity
				var oDCIEntities	= new CDCIEntities();
				var oEntity			= oDCIEntities.getNewObject();
				
				// Create the entity XML
				oEntity.addRxEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_patientUniqueID, _entity_facilityUniqueID, _entity_refill, gsInterfaceType, _entity_physicianID, _entity_dtWritten, _entity_dtDispensed, _entity_drugName );
				
				// Associate the Rx
				oDocumentEngine.AssociateEntities(oEntity.toString());
				
				// Unregister the interface
				oDocumentEngine.Unregister();
			}
			else
			{
				goLog.Information(ksErrorIncorrectScreen);
			}
		}
	}


	// ----------------------------------------------------------------------------
	// _FormatName - Properly format name fields.
	// If full name exists, that means we did not have discrete regular expressions
	// for first name / last name.  We search for the first comma, if no comma exists
	// then the full name will become the last name.  If a comma exists, everything
	// to the left will be last name, everything to the right will be first name.
	// ----------------------------------------------------------------------------		
	this._FormatName = function()
	{
		with (this)
		{
			// If full name is not populated, use first/last
			if (_entity_fullName.length > 0)
			{
				// Determine if theres a , in the name.
				var iBreak = _entity_fullName.indexOf(",");
								
				if (iBreak >= 0)
				{
					_entity_lastName 	= _entity_fullName.substring(0, iBreak).trim();
					_entity_firstName	= _entity_fullName.substring(iBreak+1, _entity_fullName.length).trim();
					
					// Dont allow zero length last names, swap with first name.
					if (_entity_lastName.length == 0)
					{
						_entity_lastName = _entity_firstName;
						_entity_firstName = "";
					}
				}
				else
				{
					_entity_lastName	= _entity_fullName;
					_entity_firstName	= "";
				}
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// OnBeforeAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations before Associate(). If this
	//						 returns false then Associate() and OnAfterAssociate()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeAssociate = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations after Associate()
	// ----------------------------------------------------------------------------
	this.OnAfterAssociate = function() { return; };

	
	// ----------------------------------------------------------------------------
	// OnBeforeLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations before LoadQueue(). If this
	//						 returns false then LoadQueue() and OnBeforeLoadQueue()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeLoadQueue = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations after LoadQueue()
	// ----------------------------------------------------------------------------
	this.OnAfterLoadQueue = function() { return; };

	
	// ----------------------------------------------------------------------------
	// Private Entity-Specific Data
	// ----------------------------------------------------------------------------
	this._entity_uniqueId			= null;
	this._entity_firstName			= null;
	this._entity_lastName			= null;
	this._entity_fullName			= null;
	this._entity_patientUniqueID	= null;
	this._entity_facilityUniqueID	= null;
	this._entity_refill				= null;
	this._entity_licenseType		= null;	
	this._entity_physicianID		= null;
	this._entity_dtWritten			= null;
	this._entity_dtDispensed		= null;
	this._entity_drugName			= null;
	
}


// ---------------------------------------------------------------------------------
// CPhysicianScreen - Class that encapsulates a Rx Screen
//
// Public Methods:
//	bool	ParseScreenData(clipdata) -- return true if screen is a match to clipdata
//	void	Associate()	-- associate entity, logs and displays a message on error
//	void	LoadQueue() -- load queue based on current entity, logs and displays on error
//
// Methods for setting regular expressions:
//			SetScreenValidation
//			SetUniqueID
//			SetSecondaryID
//			SetFirstName
//			SetLastName
//			SetFullName
//
// ---------------------------------------------------------------------------------
function CPhysicianScreen(sScreenName)
{	
	goLog.Verbose("Initializing CPhysicianScreen Object.");

	// ----------------------------------------------------------------------------
	// Constructor Logic performed here
	// ----------------------------------------------------------------------------
	this._oTokens		= new ActiveXObject(ksTokenCollection);
	this._sScreenName	= sScreenName;
	
	// Interface type must be defined globally, if not throw
	if (gsInterfaceType == null)
		throw new Error("No interface type specified.");

	// ----------------------------------------------------------------------------
	// GetName - Retrieve the name of this Screen (for Verbose Logging / Debugging)
	// ----------------------------------------------------------------------------
	this.GetName = function()
	{
		if ((null == sScreenName) || (sScreenName.length == 0))
			return "CPhysicianScreen";
		else
			return this._sScreenName;
	}
	
	// ----------------------------------------------------------------------------
	// SetScreenValidation - Sets the regular expression that determines if the
	//						 clipboard contents match this screen.
	// ----------------------------------------------------------------------------
	this.SetScreenValidation = function(sRegEx)
	{
		this._oTokens.AddToken("%CorrectScreen%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetUniqueID - Sets the regular expression that will extract the UniqueID
	// ----------------------------------------------------------------------------
	this.SetUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%uniqueID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFirstName - Sets the regular expression that will extract the first name
	// ----------------------------------------------------------------------------
	this.SetFirstName = function(sRegEx)
	{
		this._oTokens.AddToken("%firstName%", sRegEx, "");
	}
	

	// ----------------------------------------------------------------------------
	// SetLastName - Sets the regular expression that will extract the last name
	// ----------------------------------------------------------------------------
	this.SetLastName = function(sRegEx)
	{
		this._oTokens.AddToken("%lastName%", sRegEx, "");
	}	
	

	// ----------------------------------------------------------------------------
	// SetFullName - Sets the regular expression that will extract the full name
	// ----------------------------------------------------------------------------	
	this.SetFullName = function(sRegEx)
	{
		this._oTokens.AddToken("%fullName%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetSecondaryID - Sets the regular expression that will extract the
	//					  - secondaryID field.
	// ----------------------------------------------------------------------------		
	this.SetSecondaryID = function(sRegEx)
	{
		this._oTokens.AddToken("%secondaryID%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// ParseScreenData -- tests this screen and grabs any data it can. returns true
	// if this screen is a match.
	// ----------------------------------------------------------------------------	
	this.ParseScreenData = function(sScreenData)
	{
		goLog.Verbose("Entering CPhysicianScreen.ParseScreenData");
		var bReturn = false;
		this._oTokens.UpdateCollectionViaParse(sScreenData, true);
		
		if (true == this._oTokens.TestValue("%CorrectScreen%", sScreenData))
		{
			// Mark this screen has validated
			bReturn = true;	
			with(this)
			{
				_entity_uniqueId			= _oTokens.GetValue("%uniqueID%").trim();
				_entity_firstName			= _oTokens.GetValue("%firstName%").trim();
				_entity_lastName			= _oTokens.GetValue("%lastName%").trim();
				_entity_fullName			= _oTokens.GetValue("%fullName%").trim();
				_entity_secondaryID			= _oTokens.GetValue("%secondaryID%").trim();
				
				goLog.Verbose("UniqueID: %s".format(_entity_uniqueId));
				goLog.Verbose("FirstName: %s".format(_entity_firstName));
				goLog.Verbose("LastName: %s".format(_entity_lastName));
				goLog.Verbose("FullName: %s".format(_entity_fullName));
				goLog.Verbose("Secondary Id: %s".format(_entity_secondaryID));
			}
		}
		return bReturn;
	}


	// ----------------------------------------------------------------------------
	// Associate - Call to associate -- executes OnBefore, _Associate, and OnAfter
	// ----------------------------------------------------------------------------
	this.Associate = function()
	{
		goLog.Verbose("Entering CPhysicianScreen.Associate");
		with (this)
		{
			if (true == OnBeforeAssociate())
			{
				_Associate();
				OnAfterAssociate();
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQueue - Call to Load a Q based on information in the current screen
	// ----------------------------------------------------------------------------
	this.LoadQueue = function()
	{
		goLog.Verbose("Entering CPhysicianScreen.LoadQueue");
		with(this)
		{
			if (true == OnBeforeLoadQueue())
			{
				_LoadQueue();
				OnAfterLoadQueue();
			}
		}
	}


	// ----------------------------------------------------------------------------
	// _LoadQueue - private method that Loads a Q based on the current PID/MRN
	// ----------------------------------------------------------------------------	
	this._LoadQueue = function()
	{
		with (this)
		{
			var iEntityType, sEntityID;
			
			// Create Document Engine, DCIEntities object, and a container for this entity
			var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
			
			// Register the interface
			oDocumentEngine.Register(gsInterfaceType);
			
			// If Patient ID exists -- use it, else use RX ID
			if ((_entity_secondaryID != null) && (_entity_secondaryID.length > 0))
			{
				iEntityType	= DCI_FILTER_PHYSICIAN_ID_2;
				sEntityID	= _entity_secondaryID;
			}
			else
			{
				iEntityType = DCI_FILTER_PHYSICIAN_ID_1;
				sEntityID	= _entity_uniqueId;
			}
			
			// Load Document List
			oDocumentEngine.LoadDocumentList(iEntityType, sEntityID);
			
			// Unregister the interface
			oDocumentEngine.Unregister();
		}
	}	


	// ----------------------------------------------------------------------------
	// Associate - private method that Associates the current screen via DCEntities
	// ----------------------------------------------------------------------------	
	this._Associate = function()
	{
		with (this)
		{
			// require unique id for association
			if ((_entity_uniqueId != null ) && (_entity_uniqueId.length > 0))
			{
				// Register the interface
				var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
				oDocumentEngine.Register(gsInterfaceType);
				
				// see if a document is loaded
				var bIsDocLoaded	= oDocumentEngine.IsDocumentLoaded();

				// make sure there is a document loaded.
				if (!bIsDocLoaded)
				{
					goLog.Error("CPhysicianScreen._Associate Error: %s".format(ksDocumentNotLoaded));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
					return;
				}	

				var currentDocStatus = oDocumentEngine.GetDocumentData( kiDCIFieldLockType );
				
				// make sure the document is not locked.
				if ( currentDocStatus == "readonly" )
				{
					goLog.Error("CPhysicianScreen._Associate Error: %s".format(ksDocumentReadOnly));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
					return;
				}
				
				// Properly handle name fields.
				_FormatName();
	
				// Create DCIEntities object and a container for this entity
				var oDCIEntities	= new CDCIEntities();
				var oEntity			= oDCIEntities.getNewObject();
				
				// Create the entity XML
				oEntity.addPhysicianEntity(true, "", _entity_uniqueId, _entity_firstName, _entity_lastName, _entity_secondaryID, gsInterfaceType);
				
				// Associate the Rx
				oDocumentEngine.AssociateEntities(oEntity.toString());
				
				// Unregister the interface
				oDocumentEngine.Unregister();
			}
			else
			{
				goLog.Information(ksErrorIncorrectScreen);
			}
		}
	}


	// ----------------------------------------------------------------------------
	// _FormatName - Properly format name fields.
	// If full name exists, that means we did not have discrete regular expressions
	// for first name / last name.  We search for the first comma, if no comma exists
	// then the full name will become the last name.  If a comma exists, everything
	// to the left will be last name, everything to the right will be first name.
	// ----------------------------------------------------------------------------		
	this._FormatName = function()
	{
		with (this)
		{
			// If full name is not populated, use first/last
			if (_entity_fullName.length > 0)
			{
				// Determine if theres a , in the name.
				var iBreak = _entity_fullName.indexOf(",");
								
				if (iBreak >= 0)
				{
					_entity_lastName 	= _entity_fullName.substring(0, iBreak).trim();
					_entity_firstName	= _entity_fullName.substring(iBreak+1, _entity_fullName.length).trim();
					
					// Dont allow zero length last names, swap with first name.
					if (_entity_lastName.length == 0)
					{
						_entity_lastName = _entity_firstName;
						_entity_firstName = "";
					}
				}
				else
				{
					_entity_lastName	= _entity_fullName;
					_entity_firstName	= "";
				}
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// OnBeforeAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations before Associate(). If this
	//						 returns false then Associate() and OnAfterAssociate()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeAssociate = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations after Associate()
	// ----------------------------------------------------------------------------
	this.OnAfterAssociate = function() { return; };

	
	// ----------------------------------------------------------------------------
	// OnBeforeLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations before LoadQueue(). If this
	//						 returns false then LoadQueue() and OnBeforeLoadQueue()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeLoadQueue = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations after LoadQueue()
	// ----------------------------------------------------------------------------
	this.OnAfterLoadQueue = function() { return; };

	
	// ----------------------------------------------------------------------------
	// Private Entity-Specific Data
	// ----------------------------------------------------------------------------
	this._entity_uniqueId			= null;
	this._entity_firstName			= null;
	this._entity_lastName			= null;
	this._entity_fullName			= null;
	this._entity_secondaryID		= null;	
}


// ---------------------------------------------------------------------------------
// CFacilityScreen - Class that encapsulates a Rx Screen
//
// Public Methods:
//	bool	ParseScreenData(clipdata) -- return true if screen is a match to clipdata
//	void	Associate()	-- associate entity, logs and displays a message on error
//	void	LoadQueue() -- load queue based on current entity, logs and displays on error
//
// Methods for setting regular expressions:
//			SetScreenValidation
//			SetUniqueID
//			SetSecondaryID
//			SetFacilityName
//
// ---------------------------------------------------------------------------------
function CFacilityScreen(sScreenName)
{	
	goLog.Verbose("Initializing CFacilityScreen Object.");

	// ----------------------------------------------------------------------------
	// Constructor Logic performed here
	// ----------------------------------------------------------------------------
	this._oTokens		= new ActiveXObject(ksTokenCollection);
	this._sScreenName	= sScreenName;
	
	// Interface type must be defined globally, if not throw
	if (gsInterfaceType == null)
		throw new Error("No interface type specified.");

	// ----------------------------------------------------------------------------
	// GetName - Retrieve the name of this Screen (for Verbose Logging / Debugging)
	// ----------------------------------------------------------------------------
	this.GetName = function()
	{
		if ((null == sScreenName) || (sScreenName.length == 0))
			return "CFacilityScreen";
		else
			return this._sScreenName;
	}
	
	// ----------------------------------------------------------------------------
	// SetScreenValidation - Sets the regular expression that determines if the
	//						 clipboard contents match this screen.
	// ----------------------------------------------------------------------------
	this.SetScreenValidation = function(sRegEx)
	{
		this._oTokens.AddToken("%CorrectScreen%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// SetUniqueID - Sets the regular expression that will extract the UniqueID
	// ----------------------------------------------------------------------------
	this.SetUniqueID = function(sRegEx)
	{
		this._oTokens.AddToken("%uniqueID%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetFacilityName - Sets the regular expression that will extract the full name
	// ----------------------------------------------------------------------------	
	this.SetFacilityName = function(sRegEx)
	{
		this._oTokens.AddToken("%facilityName%", sRegEx, "");
	}


	// ----------------------------------------------------------------------------
	// SetSecondaryID - Sets the regular expression that will extract the
	//					  - secondaryID field.
	// ----------------------------------------------------------------------------		
	this.SetSecondaryID = function(sRegEx)
	{
		this._oTokens.AddToken("%secondaryID%", sRegEx, "");
	}
	
	
	// ----------------------------------------------------------------------------
	// ParseScreenData -- tests this screen and grabs any data it can. returns true
	// if this screen is a match.
	// ----------------------------------------------------------------------------	
	this.ParseScreenData = function(sScreenData)
	{
		goLog.Verbose("Entering CFacilityScreen.ParseScreenData");
		var bReturn = false;
		this._oTokens.UpdateCollectionViaParse(sScreenData, true);
		
		if (true == this._oTokens.TestValue("%CorrectScreen%", sScreenData))
		{
			// Mark this screen has validated
			bReturn = true;	
			with(this)
			{
				_entity_uniqueId			= _oTokens.GetValue("%uniqueID%").trim();
				_entity_facilityName		= _oTokens.GetValue("%facilityName%").trim();
				_entity_secondaryID			= _oTokens.GetValue("%secondaryID%").trim();
				
				goLog.Verbose("UniqueID: %s".format(_entity_uniqueId));
				goLog.Verbose("Facility Name: %s".format(_entity_facilityName));
				goLog.Verbose("Secondary Id: %s".format(_entity_secondaryID));				
			}
		}
		return bReturn;
	}


	// ----------------------------------------------------------------------------
	// Associate - Call to associate -- executes OnBefore, _Associate, and OnAfter
	// ----------------------------------------------------------------------------
	this.Associate = function()
	{
		goLog.Verbose("Entering CFacilityScreen.Associate");
		with (this)
		{
			if (true == OnBeforeAssociate())
			{
				_Associate();
				OnAfterAssociate();
			}
		}
	}
	
	
	// ----------------------------------------------------------------------------
	// LoadQueue - Call to Load a Q based on information in the current screen
	// ----------------------------------------------------------------------------
	this.LoadQueue = function()
	{
		goLog.Verbose("Entering CFacilityScreen.LoadQueue");
		with(this)
		{
			if (true == OnBeforeLoadQueue())
			{
				_LoadQueue();
				OnAfterLoadQueue();
			}
		}
	}


	// ----------------------------------------------------------------------------
	// _LoadQueue - private method that Loads a Q based on the current PID/MRN
	// ----------------------------------------------------------------------------	
	this._LoadQueue = function()
	{
		with (this)
		{
			var iEntityType, sEntityID;
			
			// Create Document Engine, DCIEntities object, and a container for this entity
			var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
			
			// Register the interface
			oDocumentEngine.Register(gsInterfaceType);
			
			// If Patient ID exists -- use it, else use RX ID
			if ((_entity_secondaryID != null) && (_entity_secondaryID.length > 0))
			{
				iEntityType	= DCI_FILTER_FACILITY_ID_2;
				sEntityID	= _entity_secondaryID;
			}
			else
			{
				iEntityType = DCI_FILTER_FACILITY_ID_1;
				sEntityID	= _entity_uniqueId;
			}
			
			// Load Document List
			oDocumentEngine.LoadDocumentList(iEntityType, sEntityID);
			
			// Unregister the interface
			oDocumentEngine.Unregister();
		}
	}	


	// ----------------------------------------------------------------------------
	// Associate - private method that Associates the current screen via DCEntities
	// ----------------------------------------------------------------------------	
	this._Associate = function()
	{
		with (this)
		{
			// require unique id for association
			if ((_entity_uniqueId != null ) && (_entity_uniqueId.length > 0))
			{
				// Register the interface
				var oDocumentEngine	= new ActiveXObject(ksDocumentEngine);
				oDocumentEngine.Register(gsInterfaceType);
				
				// see if a document is loaded
				var bIsDocLoaded	= oDocumentEngine.IsDocumentLoaded();

				// make sure there is a document loaded.
				if (!bIsDocLoaded)
				{
					goLog.Error("CFacilityScreen._Associate Error: %s".format(ksDocumentNotLoaded));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentNotLoaded, kiMessageBoxFirm);
					return;
				}	

				var currentDocStatus = oDocumentEngine.GetDocumentData( kiDCIFieldLockType );
				
				// make sure the document is not locked.
				if ( currentDocStatus == "readonly" )
				{
					goLog.Error("CFacilityScreen._Associate Error: %s".format(ksDocumentReadOnly));
					goActions.DisplayMessage(ksMessageBoxTitle, ksDocumentReadOnly, kiMessageBoxFirm);
					return;
				}
					
				// Create DCIEntities object and a container for this entity
				var oDCIEntities	= new CDCIEntities();
				var oEntity			= oDCIEntities.getNewObject();
				
				// Create the entity XML
				oEntity.addFacilityEntity(true, "", _entity_uniqueId, _entity_facilityName, _entity_secondaryID, gsInterfaceType);
				
				// Associate the Rx
				oDocumentEngine.AssociateEntities(oEntity.toString());
				
				// Unregister the interface
				oDocumentEngine.Unregister();
			}
			else
			{
				goLog.Information(ksErrorIncorrectScreen);
			}
		}
	}

	
	// ----------------------------------------------------------------------------
	// OnBeforeAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations before Associate(). If this
	//						 returns false then Associate() and OnAfterAssociate()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeAssociate = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterAssociate() - Allows Interfaces to override this method and perform
	//						 any needed operations after Associate()
	// ----------------------------------------------------------------------------
	this.OnAfterAssociate = function() { return; };

	
	// ----------------------------------------------------------------------------
	// OnBeforeLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations before LoadQueue(). If this
	//						 returns false then LoadQueue() and OnBeforeLoadQueue()
	//						 will not be executed.
	// ----------------------------------------------------------------------------
	this.OnBeforeLoadQueue = function() { return true; };


	// ----------------------------------------------------------------------------
	// OnAfterLoadQueue() - Allows Interfaces to override this method and perform
	//						 any needed operations after LoadQueue()
	// ----------------------------------------------------------------------------
	this.OnAfterLoadQueue = function() { return; };

	
	// ----------------------------------------------------------------------------
	// Private Entity-Specific Data
	// ----------------------------------------------------------------------------
	this._entity_uniqueId			= null;
	this._entity_facilityName		= null;
	this._entity_secondaryID		= null;	
}

