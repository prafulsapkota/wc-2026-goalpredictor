export const Sidebar = () => {
  return (
    <aside className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
          U
        </div>
        <h3 className="font-bold text-lg text-gray-900">Username</h3>
        <p className="text-sm text-gray-500">Global Participant</p>
      </div>

      <div className="space-y-6">
        <div>
          <span className="text-xs font-semibold text-gray-400 tracking-wider">POINTS</span>
          <div className="mt-1">
            <span className="text-3xl font-bold text-gray-900">0</span>
            <span className="text-sm text-gray-500 ml-1">pts</span>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-gray-400 tracking-wider">GLOBAL RANK</span>
          <div className="mt-1">
            <span className="text-3xl font-bold text-gray-900">#--</span>
            <span className="text-sm text-gray-500 ml-1">(Top --%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>
      </div>
    </aside>
  );
};
