param([string]$FixtureFolder)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, System.Data
[xml]$layout = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Title="Synthetic DocuTrack folder reader" Width="800" Height="480">
  <TabControl><TabItem Header="Folders"><StackPanel>
    <TreeView Height="180"><TreeViewItem Header="Richmond Pharmacy" IsExpanded="True">
      <TreeViewItem Header="Order Processing" IsExpanded="True">
        <TreeViewItem Name="ProcessNode" Header="Process" IsSelected="True"/><TreeViewItem Name="OtherNode" Header="PV1"/>
      </TreeViewItem></TreeViewItem></TreeView>
    <DataGrid Name="Documents" AutoGenerateColumns="True" CanUserAddRows="False" IsReadOnly="True" Height="180"/>
  </StackPanel></TabItem><TabItem Header="Search"/></TabControl>
</Window>
'@
$window = [Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $layout))
$table = New-Object System.Data.DataTable
foreach ($name in @('Document Type','Text 3','Document #')) { [void]$table.Columns.Add($name) }
[void]$table.Rows.Add('E-DC Order','SYN:0001','00012345')
[void]$table.Rows.Add('Order','SYN:0002','00012346')
$window.FindName('Documents').ItemsSource = $table.DefaultView
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [timespan]::FromMilliseconds(150)
$timer.Add_Tick({
    if (Test-Path (Join-Path $FixtureFolder 'wrong-folder')) {
        $window.FindName('OtherNode').IsSelected = $true
        [IO.File]::WriteAllText((Join-Path $FixtureFolder 'switched'), 'ready')
    }
})
$window.Add_ContentRendered({
    [IO.File]::WriteAllText((Join-Path $FixtureFolder 'ready'), 'ready')
    $timer.Start()
})
[void]$window.ShowDialog()
