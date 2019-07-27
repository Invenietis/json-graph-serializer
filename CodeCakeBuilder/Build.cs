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
    [AddPath( "%UserProfile%/.nuget/packages/**/tools*" )]
    public partial class Build : CodeCakeHost
    {
        public Build()
        {
            Cake.Log.Verbosity = Verbosity.Diagnostic;

            SimpleRepositoryInfo gitInfo = Cake.GetSimpleRepositoryInfo();
            StandardGlobalInfo globalInfo = CreateStandardGlobalInfo( gitInfo )
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
                    Cake.CleanDirectories( globalInfo.ReleasesFolder );
                   
                    globalInfo.GetNPMSolution().RunInstallAndClean( scriptMustExist: false );
                } );

            Task( "Build" )
                .IsDependentOn( "Check-Repository" )
                .IsDependentOn( "Clean" )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().RunBuild();
                } );

            Task( "Unit-Testing" )
                .IsDependentOn( "Build" )
                .WithCriteria( () => Cake.InteractiveMode() == InteractiveMode.NoInteraction
                                     || Cake.ReadInteractiveOption( "RunUnitTests", "Run Unit Tests?", 'Y', 'N' ) == 'Y' )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().RunTest();
                } );


            Task( "Create-Packages" )
                .WithCriteria( () => gitInfo.IsValid )
                .IsDependentOn( "Unit-Testing" )
                .Does( () =>
                {
                    globalInfo.GetNPMSolution().RunPack();
                } );

            Task( "Push-Packages" )
                .IsDependentOn( "Create-Packages" )
                .WithCriteria( () => gitInfo.IsValid )
                .Does( () =>
                {
                    globalInfo.PushArtifacts();
                } );

            // The Default task for this script can be set here.
            Task( "Default" )
                .IsDependentOn( "Push-Packages" );
        }

    }
}
