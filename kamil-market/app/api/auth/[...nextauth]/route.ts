import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"

async function findOrCreateUser(
  email: string,
  displayName: string,
  photoURL?: string
) {
  const usersRef = adminDb.collection("users")
  const existing = await usersRef.where("email", "==", email).limit(1).get()

  if (!existing.empty) {
    const doc = existing.docs[0]
    const data = doc.data()
    return {
      id: doc.id,
      uid: doc.id,
      email,
      name: data.displayName,
      role: data.role,
      image: data.photoURL,
    }
  }

  const countSnap = await usersRef.count().get()
  const isFirstUser = countSnap.data().count === 0
  const newUserRef = usersRef.doc()

  await newUserRef.set({
    email,
    displayName,
    photoURL: photoURL ?? null,
    role: isFirstUser ? "admin" : "user",
    createdAt: Timestamp.now(),
  })

  return {
    id: newUserRef.id,
    uid: newUserRef.id,
    email,
    name: displayName,
    role: isFirstUser ? "admin" : "user",
    image: photoURL,
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP", type: "text" },
        loginType: { label: "Login Type", type: "text" },
        displayName: { label: "Display Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        const email = credentials.email as string

        try {
          if (credentials.loginType === "otp") {
            const otpDoc = await adminDb.collection("otpCodes").doc(email).get()
            if (!otpDoc.exists) return null
            const { code, expiresAt } = otpDoc.data()!
            if (code !== credentials.otp) return null
            if (expiresAt.toDate() < new Date()) return null
            await adminDb.collection("otpCodes").doc(email).delete()
            return await findOrCreateUser(
              email,
              (credentials.displayName as string) || email.split("@")[0]
            )
          }

          if (credentials.loginType === "password") {
            const res = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  password: credentials.password,
                  returnSecureToken: true,
                }),
              }
            )
            const data = await res.json()
            if (!res.ok || data.error) return null
            return await findOrCreateUser(
              email,
              data.displayName || email.split("@")[0],
              data.photoUrl
            )
          }

          return null
        } catch (error) {
          console.error("[NextAuth] authorize error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          await findOrCreateUser(
            user.email!,
            user.name || user.email!.split("@")[0],
            user.image ?? undefined
          )
        } catch (error) {
          console.error("[NextAuth] signIn callback error:", error)
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const userDocs = await adminDb
          .collection("users")
          .where("email", "==", user.email)
          .limit(1)
          .get()
        if (!userDocs.empty) {
          const userData = userDocs.docs[0].data()
          token.uid = userDocs.docs[0].id
          token.role = userData.role ?? "user"
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.uid = token.uid as string
        session.user.role = (token.role as "user" | "admin") ?? "user"
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
})

export { handler as GET, handler as POST }
