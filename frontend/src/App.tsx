import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import UsernamePrompt from './components/UsernamePrompt';
import { useUser } from './hooks/useUser';
import {
  Dashboard,
  UseCaseList,
  UseCaseDetail,
  UseCaseForm,
  DependencyForm,
  PropertiesEditor,
  DependenciesPage,
  MatrixPage,
  SettingsPage,
} from './pages';

function App() {
  const { setUsername, isLoggedIn } = useUser();

  return (
    <BrowserRouter>
      <UsernamePrompt
        isOpen={!isLoggedIn}
        onSubmit={setUsername}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="use-cases" element={<UseCaseList />} />
          <Route path="use-cases/new" element={<UseCaseForm />} />
          <Route path="use-cases/:id" element={<UseCaseDetail />} />
          <Route path="use-cases/:id/edit" element={<UseCaseForm />} />
          <Route path="use-cases/:id/dependencies/new" element={<DependencyForm />} />
          <Route path="use-cases/:id/properties" element={<PropertiesEditor />} />
          <Route path="dependencies" element={<DependenciesPage />} />
          <Route path="matrix" element={<MatrixPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Placeholder routes */}
          <Route path="data-sources" element={<PlaceholderPage title="Data Sources" />} />
          <Route path="knowledge" element={<PlaceholderPage title="Knowledge Base" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="text-center py-16">
      <h1 className="text-2xl font-bold text-primary-900">{title}</h1>
      <p className="text-gray-500 mt-2">This page is under construction</p>
    </div>
  );
}

export default App;
