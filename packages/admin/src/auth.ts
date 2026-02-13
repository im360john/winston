import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const config = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Import bcrypt dynamically to avoid Edge Runtime issues
        const bcrypt = (await import('bcryptjs')).default;

        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin', 10);

        // Check username
        if (credentials.username !== ADMIN_USERNAME) {
          return null;
        }

        // Check password
        const isValid = await bcrypt.compare(String(credentials.password), ADMIN_PASSWORD_HASH);
        if (!isValid) {
          return null;
        }

        return {
          id: '1',
          name: ADMIN_USERNAME,
          email: `${ADMIN_USERNAME}@winston.ai`,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to login page
      return !!auth;
    },
  },
});

export const { handlers, auth, signIn, signOut } = config;
export const { GET, POST } = handlers;
