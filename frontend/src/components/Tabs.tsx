import { useState } from 'react';

export const Tabs = () => {
  const [activeTab] = useState('matches');

  return (
    <div className="flex flex-col">
      {/* Content area would switch based on activeTab */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-xl font-bold mb-4 capitalize">{activeTab}</h2>
        <p className="text-gray-600">Content for {activeTab} goes here...</p>
      </div>
    </div>
  );
};
