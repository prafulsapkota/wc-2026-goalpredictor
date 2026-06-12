export const Navbar = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-bold text-xl tracking-tight text-gray-900">
          GOALPREDICTOR
        </div>
        <nav className="flex space-x-4">
          {['Matches', 'Bracket', 'Leaderboard', 'My Stats'].map((tab) => (
            <button
              key={tab}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="flex items-center space-x-4">
          <button className="text-gray-500 hover:text-gray-700">
            <i className="fa-solid fa-moon"></i>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-gray-900">Username</span>
            <span className="text-xs text-gray-500">0 pts</span>
          </div>
          <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">
            <i className="fa-solid fa-sign-out"></i>
          </button>
        </div>
      </div>
    </header>
  );
};
