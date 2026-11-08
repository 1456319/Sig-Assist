/******************************************************************************
Copyright (C) 2006 Integra Specialty Care Systems, Inc.  All rights reserved. 
 
This is PROPRIETARY SOURCE CODE of Integra Specialty Care, Inc.  The contents of
this file may not be disclosed to third parties, copied or duplicated in any
form, in whole or in part, without the prior written permission of Integra 
Specialty Care Systems, Inc. 
 
*******************************************************************************
 
     $Product: DocuTrack $
 
     $Archive: /DocMgmtWeb/Common/Scripts/DCIEntities.js $
    $Revision: 30 $
        $Date: 3/28/06 10:56a $
      $Author: Timo $
 
  $NoKeywords: $
  
B I G   N O T E   --   B I G   N O T E   --   B I G   N O T E

This script is used by: Document Import, Standard Interface, and the web
application -- unit test all systems after making changes!

B I G   N O T E   --   B I G   N O T E   --   B I G   N O T E

This script is used by: Document Import, Standard Interface, and the web
application -- unit test all systems after making changes!

B I G   N O T E   --   B I G   N O T E   --   B I G   N O T E

This script is used by: Document Import, Standard Interface, and the web
application -- unit test all systems after making changes!

******************************************************************************/ 
                                   

/*-----------------------------------------------------------------------------
Create an entity package for DCI using an XML document conforming to
the following form:

<EntityRootData >
	<!-- Zero to many Ancillaries are allowed -->
	<Ancillaries>
		<Ancillary Associate="" UniqueID="" SecondaryID="" AncillaryName="" 
					DateWritten="" OrderType="" Notes=""
					PatientUniqueID="" FirstName="" LastName="" 
					FacilityUniqueID="" PhysicianUniqueID="" PharmacyUniqueID= "" />
		...
	</Ancillaries>

	<!-- Zero to many Facilities are allowed -->
	<Facilities>
		<Facility Associate="" UniqueID="" SecondaryID="" Name="" PharmacyUniqueID= "" />
		...
	</Facilities>

	<!-- Zero to many Delivery Manifests are allowed -->
	<Manifests>
		<Manifest Associate="" UniqueID="" SecondaryID="" SignedByLastName = ""
					SignedByFirstName="" DeliveryDateTime=""  FacilityUniqueID=""
					DirectDelivery="" PharmacyUniqueID= "" />
			*** DirectDelivery allows the server side processing to determine if it should
				QueryEntity() or not.  Direct Delivery manifest should NOT be 
				queried on.  DirectDelivery will be 1 if a Direct Delivery 
				manifest otherwise 0 indicating the manifest is from a PIS.  The
				absense of the attribute will mean it is from a PIS.
		...
			*** This is only used by Document Import to signify
			*** the license / interface type that is passing this information
			*** to the database for processing.
				LicenseType=""
	</Manifests>

	<!-- Zero to many Patients are allowed -->
	<Patients>
		<Patient Associate="" UniqueID="" SecondaryID="" 
					FirstName="" LastName="" Location="" DOB="" FacilityUniqueID="" PharmacyUniqueID= "" />
		...
	</Patients>

	<!-- Zero to many Physicians are allowed -->
	<Physicians>
		<Physician Associate="" UniqueID="" SecondaryID="" 
					FirstName="" LastName="" PharmacyUniqueID= "" />
		...
	</Physicians>

	<!-- Zero to many RXs are allowed -->
	<RXs>
		<RX Associate="" UniqueID="" SecondaryID="" MedicationName="" 
					DateWritten="" DateDispensed="" Status="" Notes="" 
					PatientUniqueID="" FirstName="" LastName="" 
					FacilityUniqueID="" PhysicianUniqueID="" PharmacyUniqueID= "" 
					*** This is only used by Document Import to signify
					*** that this is an RX that was read as a barcode and
					*** needs to be Submitted for refilling.
					Refill=""
					LicenseType=""
					/>
		...
	</RXs>
</EntityRootData>

/----------------------------------------------------------------------------*/

//-----------------------------------------------------------------------------
// Constructor for Association Package class.
//-----------------------------------------------------------------------------
function CDCIEntities()
{
	this.ksXMLDocVersion		= new String( "Msxml2.DOMDocument" );

	this.ksRoot					= new String( "EntityRootData" );

	this.ksAncillaries			= new String( "Ancillaries" );
	this.ksAncillary			= new String( "Ancillary" );
	this.ksFacilities			= new String( "Facilities" );
	this.ksFacility				= new String( "Facility" );
	this.ksManifests			= new String( "Manifests" );
	this.ksManifest				= new String( "Manifest" );
	this.ksManifests			= new String( "Manifests" );
	this.ksManifest				= new String( "Manifest" );
	this.ksPatients				= new String( "Patients" );
	this.ksPatient				= new String( "Patient" );
	this.ksPhysicians			= new String( "Physicians" );
	this.ksPhysician			= new String( "Physician" );
	this.ksRXs					= new String( "RXs" );
	this.ksRX					= new String( "RX" );

	this.ksAssociate			= new String( "Associate" );
	this.ksUniqueId				= new String( "UniqueID" ); 
	this.ksSecondaryId			= new String( "SecondaryID" ); 
	this.ksFirstName			= new String( "FirstName" ); 
	this.ksLastName				= new String( "LastName" );
	this.ksPatientUniqueId		= new String( "PatientUniqueID" );
	this.ksFacilityUniqueId		= new String( "FacilityUniqueID" );
	this.ksRefill				= new String( "Refill" );
	this.ksLicenseType			= new String( "LicenseType" );
	this.ksMedicationName		= new String( "MedicationName" );
	this.ksDateWritten			= new String( "DateWritten" );
	this.ksDateDispensed		= new String( "DateDispensed" );
	this.ksPhysicianId			= new String( "PhysicianUniqueID" );
	this.ksDeliveryDateTime		= new String( "DeliveryDateTime" );
	this.ksAncillaryName		= new String( "AncillaryName" );
	this.ksOrderType			= new String( "OrderType" );
	this.ksFacilityName			= new String( "Name" );
	this.ksLocation				= new String( "Location" );
	this.ksDateOfBirth			= new String( "DOB" );
	this.ksSignedByFirstName	= new String( "SignedByFirstName" );
	this.ksSignedByLastName		= new String( "SignedByLastName" );
	this.ksDirectDelivery		= new String( "DirectDelivery" );
	this.ksAssociationText		= new String( "associationtext" );
	this.ksPharmacyUniqueId		= new String( "PharmacyUniqueID" );
	
	// XML DOM Nodes
	this._Ancillaries			= null;
	this._Facilities			= null;
	this._Manifests				= null;
	this._Patients				= null;
	this._Physicians			= null;
	this._RXs					= null;
	this._xmlDoc				= null;
	
	with ( this )
	{
		_xmlDoc = new ActiveXObject( ksXMLDocVersion );
		var inst = _xmlDoc.createProcessingInstruction("xml", 'version="1.0" encoding="UTF-8"');
		_xmlDoc.insertBefore( inst, _xmlDoc.childNodes.item(0) );
		
		// add a root node.
		var newNode = _xmlDoc.createElement( ksRoot );
		_xmlDoc.appendChild( newNode );
		
		// add the Ancillaries node.
		newNode = _xmlDoc.createElement( ksAncillaries );
		_Ancillaries = _xmlDoc.documentElement.appendChild( newNode );

		// add the Facilities node.
		newNode = _xmlDoc.createElement( ksFacilities );
		_Facilities = _xmlDoc.documentElement.appendChild( newNode );

		// add the Manifests node.
		newNode = _xmlDoc.createElement( ksManifests );
		_Manifests = _xmlDoc.documentElement.appendChild( newNode );

		// add the Patients node.
		newNode = _xmlDoc.createElement( ksPatients );
		_Patients = _xmlDoc.documentElement.appendChild( newNode );

		// add the Physicians node.
		newNode = _xmlDoc.createElement( ksPhysicians );
		_Physicians = _xmlDoc.documentElement.appendChild( newNode );

		// add the RXs node.
		newNode = _xmlDoc.createElement( ksRXs );
		_RXs = _xmlDoc.documentElement.appendChild( newNode );
	}		
}

//-----------------------------------------------------------------------------
// Method to add an Ancillary entity node to the Ancillaries node.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addAncillaryEntity = function( associate, pharmacyUniqueId, uniqueId, firstName, lastName, alternateId, facilityUniqueID, licenseType)
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksAncillary );
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
		newNode.setAttribute( ksLicenseType, licenseType.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );		

		if ( firstName != null )		newNode.setAttribute( ksFirstName, firstName.trim() );
		if ( lastName != null )			newNode.setAttribute( ksLastName, lastName.trim() );
		if ( alternateId != null )		newNode.setAttribute( ksPatientUniqueId, alternateId.trim() );
		if ( facilityUniqueID != null )	newNode.setAttribute( ksFacilityUniqueId, facilityUniqueID.trim() );

		_Ancillaries.appendChild( newNode );
	}
}

//-----------------------------------------------------------------------------
// Method to add an Facility entity node to the Facilities node.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addFacilityEntity = function( associate, pharmacyUniqueId, uniqueId, facilityName, secondaryId, licenseType )
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksFacility );
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
		newNode.setAttribute( ksLicenseType, licenseType.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );		
		
		if ( facilityName != null )			newNode.setAttribute( ksFacilityName, facilityName.trim() );
		if ( secondaryId != null )			newNode.setAttribute( ksSecondaryId, secondaryId.trim() );

		_Facilities.appendChild( newNode );
	}
}

//-----------------------------------------------------------------------------
// Method to add an Manifest entity node to the Manifests node.
//		<Manifest Associate="" UniqueID="" SecondaryID="" SignedByLastName = ""
//					SignedByFirstName="" DeliveryDateTime="" FacilityUniqueID=""
//					DirectDelivery="" PharmacyUniqueID="" />
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addManifestEntity = function( associate, pharmacyUniqueId, uniqueId, secondaryId, deliveryDateTime, signedByFirstName, signedByLastName, facilityUniqueId, directDelivery, licenseType )
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksManifest );
		
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
		newNode.setAttribute( ksLicenseType, licenseType.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );		
		
		if ( secondaryId != null )			newNode.setAttribute( ksSecondaryId, secondaryId.trim() );
		if ( deliveryDateTime != null )		newNode.setAttribute( ksDeliveryDateTime, deliveryDateTime.trim() );
		if ( signedByFirstName != null )	newNode.setAttribute( ksSignedByFirstName, signedByFirstName.trim() );
		if ( signedByLastName != null )		newNode.setAttribute( ksSignedByLastName, signedByLastName.trim() );
		if ( facilityUniqueId != null )		newNode.setAttribute( ksFacilityUniqueId, facilityUniqueId.trim() );
		if ( directDelivery != null )		newNode.setAttribute( ksDirectDelivery, ( directDelivery == true ) ? 1 : 0 );

		_Manifests.appendChild( newNode );
	}
}


//-----------------------------------------------------------------------------
// Method to add an Patient entity node to the Patients node.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addPatientEntity = function( associate, pharmacyUniqueId, uniqueId, firstName, lastName, facilityUniqueID, location, secondaryID, dateOfBirth, licenseType )
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksPatient );
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
		newNode.setAttribute( ksLicenseType, licenseType.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );		

		if ( firstName != null )		newNode.setAttribute( ksFirstName, firstName.trim() );
		if ( lastName != null )			newNode.setAttribute( ksLastName, lastName.trim() );
		if ( facilityUniqueID != null )	newNode.setAttribute( ksFacilityUniqueId, facilityUniqueID.trim() );
		if ( location != null )			newNode.setAttribute( ksLocation, location.trim() );
		if ( secondaryID != null )	newNode.setAttribute( ksSecondaryId, secondaryID.trim() );
		if ( dateOfBirth != null )	newNode.setAttribute( ksDateOfBirth, dateOfBirth.trim() );

		_Patients.appendChild( newNode );
	}
}

//-----------------------------------------------------------------------------
// Method to add an Physician entity node to the Physicians node.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addPhysicianEntity = function( associate, pharmacyUniqueId, uniqueId, firstName, lastName, secondaryID, licenseType )
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksPhysician );
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
        newNode.setAttribute( ksLicenseType, licenseType.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );		
		
		if ( firstName != null )		newNode.setAttribute( ksFirstName, firstName.trim() );
		if ( lastName != null )			newNode.setAttribute( ksLastName, lastName.trim() );
		if ( secondaryID != null )		newNode.setAttribute( ksSecondaryId, secondaryID.trim() );

		_Physicians.appendChild( newNode );
	}
}

//-----------------------------------------------------------------------------
// Method to add an RX entity node to the RXs node.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addRxEntity = function( associate, pharmacyUniqueId, uniqueId, firstName, lastName, patientUniqueID, facilityUniqueID, refill, licenseType, physicianUniqueID, dateWritten, dateDispensed, medicationName)
{
	with ( this )
	{
		var newNode = _xmlDoc.createElement( ksRX );
		newNode.setAttribute( ksAssociate, ( associate == true ) ? 1 : 0 );
		newNode.setAttribute( ksUniqueId, uniqueId.trim() );
		newNode.setAttribute( ksPharmacyUniqueId, pharmacyUniqueId.trim() );
		newNode.setAttribute( ksLicenseType, licenseType.trim() );
		
		if ( firstName != null && firstName != "" )		newNode.setAttribute( ksFirstName, firstName.trim() );
		if ( lastName != null && lastName != "" )			newNode.setAttribute( ksLastName, lastName.trim() );
		if ( patientUniqueID != null && patientUniqueID != "" )	newNode.setAttribute( ksPatientUniqueId, patientUniqueID.trim() );
		if ( facilityUniqueID != null && facilityUniqueID != "" )	newNode.setAttribute( ksFacilityUniqueId, facilityUniqueID.trim() );
		if ( refill != null && refill != "" )			newNode.setAttribute( ksRefill, ( refill == true ) ? 1 : 0 );
		if ( physicianUniqueID != null && physicianUniqueID != "" ) newNode.setAttribute( ksPhysicianId, physicianUniqueID.trim() );
		if ( dateWritten != null && dateWritten != "" )		newNode.setAttribute( ksDateWritten, dateWritten.trim() );
		if ( dateDispensed != null && dateDispensed != "" )	newNode.setAttribute( ksDateDispensed, dateDispensed.trim() );
		if ( medicationName != null && medicationName != "" )	newNode.setAttribute( ksMedicationName, medicationName.trim() );

		_RXs.appendChild( newNode );
	}
}


//-----------------------------------------------------------------------------
// Method to return the association text attribute the first RX node
// node if it exists.  It will return null otherwise.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.getAssociationText = function()
{
	var associationText = null;
	
	with ( this )
	{
		if ( _RXs != null && _RXs.firstChild != null )
		{
			associationText = _RXs.firstChild.getAttribute( ksAssociationText );
		}
	}
	
	return associationText;
}


//-----------------------------------------------------------------------------
// Will return a "new" CDCIEntities object.  This method is used by routines
// that must "eval" this code into their "namespace".
//-----------------------------------------------------------------------------
CDCIEntities.prototype.getNewObject = function()
{
	return new CDCIEntities();
}


//-----------------------------------------------------------------------------
// Method to inflate the object based on a xml string.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.loadXML = function( xmlAssociationDoc )
{
	with ( this )
	{
		_xmlDoc.loadXML( xmlAssociationDoc );
		
		// make sure we don't add a processing instruction node if it already exists.
		var xmlNode = _xmlDoc.firstChild;
		if ( xmlNode != null && xmlNode.nodeTypeString != "processinginstruction" )
		{
			var inst = _xmlDoc.createProcessingInstruction("xml", 'version="1.0" encoding="UTF-8"');
			_xmlDoc.insertBefore( inst, _xmlDoc.childNodes.item(0) );
		}

		// get the pointer nodes.
		_Ancillaries	= _xmlDoc.documentElement.selectSingleNode( ksAncillaries );
		_Facilities		= _xmlDoc.documentElement.selectSingleNode( ksFacilities );
		_Manifests		= _xmlDoc.documentElement.selectSingleNode( ksManifests );
		_Patients		= _xmlDoc.documentElement.selectSingleNode( ksPatients );
		_Physicians		= _xmlDoc.documentElement.selectSingleNode( ksPhysicians );
		_RXs			= _xmlDoc.documentElement.selectSingleNode( ksRXs );
		
	}
}

//-----------------------------------------------------------------------------
// Generic routine to add an attribute with a specific value to all nodes
// in an entity collection.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addAttributeToEntityNodes = function(collection, nodeName, attributeName, attributeValue, overwrite)
{
    if(collection != null)
    {
        var nodes = collection.getElementsByTagName(nodeName);
        if(nodes != null)
        {
	        for( var index = 0; index < nodes.length; index++ )
	        {
	            if(overwrite || nodes[index].getAttribute(attributeName) == null)
    	        {
	                nodes[index].setAttribute(attributeName, attributeValue);
                }
	        }
        }
    }
}

//-----------------------------------------------------------------------------
// Generic routine to add an attribute with a specific value to all nodes in 
// all entity collections.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.addAttributeToAllEntities = function(attributeName, attributeValue, overwrite)
{
	this.addAttributeToEntityNodes(this._Ancillaries, this.ksAncillary, attributeName, attributeValue, overwrite);
	this.addAttributeToEntityNodes(this._Facilities, this.ksFacility, attributeName, attributeValue, overwrite);
    this.addAttributeToEntityNodes(this._Manifests, this.ksManifest, attributeName, attributeValue, overwrite);
	this.addAttributeToEntityNodes(this._Patients, this.ksPatient, attributeName, attributeValue, overwrite);
	this.addAttributeToEntityNodes(this._Physicians, this.ksPhysician, attributeName, attributeValue, overwrite);
	this.addAttributeToEntityNodes(this._RXs, this.ksRX, attributeName, attributeValue, overwrite);
}

//-----------------------------------------------------------------------------
// is*Empty()
// Determines if the object contains any items.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.isManifestsEmpty = function() { return this._Manifests.selectSingleNode( this.ksManifest ) == null; }
CDCIEntities.prototype.isRXsEmpty		= function() { return this._RXs.selectSingleNode( this.ksRX ) == null; }
CDCIEntities.prototype.isEmpty			= function() { return this.isManifestsEmpty() && this.isRXsEmpty(); }
																		  
	
//-----------------------------------------------------------------------------
// Extracter that converts the XML document to a string.
//-----------------------------------------------------------------------------
CDCIEntities.prototype.toString = function() { return this._xmlDoc.xml; }

	
// End of file.
