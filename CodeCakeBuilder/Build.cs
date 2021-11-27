using Cake.Npm;
using Cake.Npm.RunScript;
using Cake.Common.IO;
using Cake.Common.Solution;
using Cake.Core;
using Cake.Npm;
using Cake.Core.Diagnostics;
using Cake.Core.IO;
using SimpleGitVersion;
using System.Linq;
using Cake.Npm.Install;
using Cake.Npm.RunScript;

namespace CodeCake
{
    
    public partial class Build : CodeCakeHost
    {
        public Build()
        {
            Cake.Log.Verbosity = Verbosity.Diagnostic;

            StandardGlobalInfo globalInfo = CreateStandardGlobalInfo()
                                                .AddNPM()
                                                .SetCIBuildTag();

            Task( "Check-Repository" )
                .Does( () =>
                {
                    globalInfo.TerminateIfShouldStop();
                } );

            Task( "Clean" )
                .IsDependentOn( "Check-Repository" )
                .Does( () =>
                {
                    Cake.CleanDirectories( globalInfo.ReleasesFolder.ToString() );
                   
                    globalInfo.GetNPMSolution().Clean();
                } );

            Task( "Build" )
                .IsDependentOn( "Check-Repository" )
                .IsDependentOn( "Clean" )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().Build();
                } );

            Task( "Unit-Testing" )
                .IsDependentOn( "Build" )
                .WithCriteria( () => Cake.InteractiveMode() == InteractiveMode.NoInteraction
                                     || Cake.ReadInteractiveOption( "RunUnitTests", "Run Unit Tests?", 'Y', 'N' ) == 'Y' )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().Test();
                } );


            Task( "Create-Packages" )
                .WithCriteria( () => globalInfo.IsValid )
                .IsDependentOn( "Unit-Testing" )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().RunPack();
                } );

            Task( "Push-Packages" )
                .IsDependentOn( "Create-Packages" )
                .WithCriteria( () => globalInfo.IsValid )
                .Does( async () =>
                {
                    await globalInfo.PushArtifactsAsync();
                } );

            // The Default task for this script can be set here.
            Task( "Default" )
                .IsDependentOn( "Push-Packages" );
        }

    }
}
