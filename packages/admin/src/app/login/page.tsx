import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { LogIn } from 'lucide-react';

export default function LoginPage() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary-600 rounded-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Winston Admin
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to access the admin dashboard
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-gray-600">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Default credentials: admin / admin</p>
          <p className="mt-1">Change these in production!</p>
        </div>
      </div>
    </div>
  );
}
