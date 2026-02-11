import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Call Winston API to verify credentials
          const response = await axios.post(`${API_URL}/api/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          })

          if (response.data.user) {
            // Return user object
            return {
              id: response.data.user.id,
              email: response.data.user.email,
              name: response.data.user.name,
              tenantId: response.data.user.tenantId,
            }
          }

          return null
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add user data to token on sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.tenantId = (user as any).tenantId
      }
      return token
    },
    async session({ session, token }) {
      // Add token data to session
      if (session.user) {
        (session.user as any).id = token.id as string
        (session.user as any).tenantId = token.tenantId as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}
