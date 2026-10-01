@echo off
setlocal
set JAVA_HOME=%JAVA_HOME%
if "%JAVA_HOME%"=="" set JAVA_HOME=C:\Program Files\Java\jdk-21
java -Dmaven.multiModuleProjectDirectory="%~dp0" -classpath "%~dp0\.mvn\wrapper\maven-wrapper.jar" org.apache.maven.wrapper.MavenWrapperMain %*
