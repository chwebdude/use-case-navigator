import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout";
import UsernamePrompt from "./components/UsernamePrompt";
import { useUser } from "./hooks/useUser";
import {
  Dashboard,
  FactsheetList,
  FactsheetDetail,
  FactsheetForm,
  DependencyForm,
  PropertiesEditor,
  DependenciesPage,
  MatrixPage,
  SettingsPage,
  SpiderPage,
} from "./pages";

function App() {
  const { setUsername, isLoggedIn } = useUser();

  return (
    <BrowserRouter>
      <UsernamePrompt isOpen={!isLoggedIn} onSubmit={setUsername} />
      <Routes>
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
