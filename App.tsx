import React from 'react';
import { DataProvider, useData } from './context/DataContext';
import AuthScreen from './components/Auth';
import EmployeeView from './components/EmployeeView';
import AdminView from './components/AdminView';
import { Layout } from './components/Layout';

const AppContent: React.FC = () => {
  const { role, currentEmployee, isLoading, actions } = useData();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-black text-emerald-950 tracking-tighter">WASABI MONEY</h1>
      </div>
    );
  }

  if (!role) {
    return <AuthScreen />;
  }

  return (
    <Layout role={role} employeeName={currentEmployee?.name} onLogout={actions.logout}>
      {role === 'USER' ? <EmployeeView /> : <AdminView />}
    </Layout>
  );
};

const App: React.FC = () => (
  <DataProvider>
    <AppContent />
  </DataProvider>
);

export default App;