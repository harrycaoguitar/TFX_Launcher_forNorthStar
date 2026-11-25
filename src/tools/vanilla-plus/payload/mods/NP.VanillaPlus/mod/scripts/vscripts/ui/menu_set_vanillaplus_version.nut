untyped
#if VANILLA
// because we want Northstar to do its thing 
// only run if in vanilla compatibility

global function VP_SetVersionLabel

void function VP_SetVersionLabel()
{
        var mainMenu = GetMenu( "MainMenu" ) //Gets main menu element
        var versionLabel = GetElementsByClassname( mainMenu, "nsVersionClass" )[0] //Gets the label from the mainMenu element.
		foreach ( ModInfo mod in NSGetModInformation( "VanillaPlus" ) )
		{
			if ( mod.name == "VanillaPlus" )
			{
				Hud_SetText( versionLabel, mod.version ) // Sets the label text from VanillaPlus.
				break
			}
		}
}
#endif
