import { useState } from 'react';

export const AuthCard = () => {
  const [isLogin, setIsLogin] = useState(true);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="mb-4 text-2xl font-bold">{isLogin ? 'Sign in' : 'Create account'}</h2>
        {/* Placeholder for form */}
        <button
          className="mt-4 text-blue-500"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};
