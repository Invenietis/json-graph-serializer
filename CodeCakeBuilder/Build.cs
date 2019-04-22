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

            var releasesDir = Cake.Directory( "CodeCakeBuilder/Releases" );

            var packageDir = Cake.Directory( "js" );
            var packageJsonPath = packageDir.Path.CombineWithFilePath( "package.json" ).FullPath;
            var packageLockJsonPath = packageDir.Path.CombineWithFilePath( "package-lock.json" ).FullPath;
            SimpleRepositoryInfo gitInfo = Cake.GetSimpleRepositoryInfo();
            CheckRepositoryInfo globalInfo = null;
            NpmRepository npmInfo = null;
            
            Task( "Check-Repository" )
                .Does( () =>
                {
                    globalInfo = StandardCheckRepositoryWithoutNuget( gitInfo );
                    globalInfo.AddAndInitRepository( npmInfo = new NpmRepository( Cake, globalInfo, Cake.NpmGetProjectsToPublish().ToList() ) );
                    if( globalInfo.ShouldStop )
                    {
                        Cake.TerminateWithSuccess( "All packages from this commit are already available. Build skipped." );
                    }
                } );
            Task( "Clean" )
                .IsDependentOn( "Check-Repository" )
                .Does( () =>
                {
                    Cake.CreateDirectory(releasesDir);
                    Cake.CleanDirectories( releasesDir );
                    Cake.DeleteFiles( "Tests/**/TestResult*.xml" );
                    // npm run clean
                    Cake.NpmInstall( new NpmInstallSettings()
                    {
                        WorkingDirectory = packageDir
                    } );
                    Cake.NpmRunScript( new NpmRunScriptSettings()
                    {
                        WorkingDirectory = packageDir,
                        ScriptName = "clean"
                    }
                    );
                } );

            Task( "Build" )
                .IsDependentOn( "Check-Repository" )
                .IsDependentOn( "Clean" )
                .Does( () =>
                {
                    Cake.NpmRunScript(
                        "build",
                        s => s
                            .WithLogLevel( NpmLogLevel.Info )
                            .FromPath( packageDir )
                    );
                } );

            Task( "Unit-Testing" )
                .IsDependentOn( "Build" )
                .WithCriteria( () => Cake.InteractiveMode() == InteractiveMode.NoInteraction
                                     || Cake.ReadInteractiveOption( "RunUnitTests", "Run Unit Tests?", 'Y', 'N' ) == 'Y' )
                .Does( () =>
                {
                    Cake.NpmRunScript(
                        "test",
                        s => s
                            .WithLogLevel( NpmLogLevel.Info )
                            .FromPath( packageDir )
                    );
                } );


            Task( "Create-Packages" )
                .WithCriteria( () => gitInfo.IsValid )
                .IsDependentOn( "Unit-Testing" )
                .Does( () =>
                {
                    NpmPackWithNewVersion( globalInfo.Version, packageDir, releasesDir );
                } );

            Task( "Push-Packages" )
                .IsDependentOn( "Create-Packages" )
                .WithCriteria( () => gitInfo.IsValid )
                .Does( () =>
                {
                    globalInfo.PushArtifacts( releasesDir );
                } );

            // The Default task for this script can be set here.
            Task( "Default" )
                .IsDependentOn( "Push-Packages" );
        }

    }
}
