import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Tabs } from './components/Tabs';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <Tabs />
          </div>
          <div className="w-full md:w-80">
            <Sidebar />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
