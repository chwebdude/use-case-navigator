import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout, PageTitleManager } from "./components/layout";
import UsernamePrompt from "./components/UsernamePrompt";
import { useAppSettings } from "./hooks/useAppSettings";
import { useUser } from "./hooks/useUser";
import { configureApm } from "./lib/apm";
import {
  Dashboard,
  FactsheetList,
  FactsheetDetail,
  FactsheetPrint,
  FactsheetFullPrint,
  FactsheetDependenciesPrint,
  FactsheetDependenciesChainPrint,
  FactsheetForm,
  DependencyForm,
  PropertiesEditor,
  DependenciesPage,
  MatrixPage,
  MatrixPrint,
  SettingsPage,
  SpiderPage,
  ScatterPage,
  ImpactAnalysisPage,
  ChatPage,
  AdminPowerPage,
} from "./pages";

function App() {
  const { setUsername, isLoggedIn, username } = useUser();
  const { settings: appSettings, loading: appSettingsLoading } =
    useAppSettings();

  useEffect(() => {
    if (appSettingsLoading) {
      return;
    }

    configureApm({
      serverUrl: appSettings.elasticApmServerUrl,
      serviceName:
        import.meta.env.VITE_ELASTIC_APM_SERVICE_NAME || appSettings.title,
      environment: import.meta.env.MODE,
      username,
    });
  }, [
    appSettingsLoading,
    appSettings.elasticApmServerUrl,
    appSettings.title,
    username,
  ]);

  return (
    <BrowserRouter>
      <UsernamePrompt isOpen={!isLoggedIn} onSubmit={setUsername} />
      <PageTitleManager appTitle={appSettings.title} />
      <Routes>
        <Route path="factsheets/:id/print" element={<FactsheetPrint />} />
        <Route
          path="factsheets/:id/print-full"
          element={<FactsheetFullPrint />}
        />
        <Route
          path="factsheets/:id/dependencies/print"
          element={<FactsheetDependenciesPrint />}
        />
        <Route
          path="factsheets/:id/dependencies/print-chain"
          element={<FactsheetDependenciesChainPrint />}
        />
        <Route path="matrix/print" element={<MatrixPrint />} />
        <Route path="give-me-power" element={<AdminPowerPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="factsheets" element={<FactsheetList />} />
          <Route path="factsheets/new" element={<FactsheetForm />} />
          <Route path="factsheets/:id" element={<FactsheetDetail />} />
          <Route path="factsheets/:id/edit" element={<FactsheetForm />} />
          <Route
            path="factsheets/:id/dependencies/new"
            element={<DependencyForm />}
          />
          <Route
            path="factsheets/:id/properties"
            element={<PropertiesEditor />}
          />
          <Route path="dependencies" element={<DependenciesPage />} />
          <Route path="matrix" element={<MatrixPage />} />
          <Route path="spider" element={<SpiderPage />} />
          <Route path="scatter" element={<ScatterPage />} />
          <Route path="impact" element={<ImpactAnalysisPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
