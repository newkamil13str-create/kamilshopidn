import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendOTPEmail } from "@/lib/email"
import { generateOTP } from "@/lib/utils"
import { Timestamp } from "firebase-admin/firestore"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 })

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await adminDb.collection("otpCodes").doc(email).set({
      code: otp,
      expiresAt: Timestamp.fromDate(expiresAt),
    })

    await sendOTPEmail(email, otp)
    return NextResponse.json({ success: true, message: "OTP terkirim ke email Anda" })
  } catch (error) {
    console.error("[OTP] send error:", error)
    return NextResponse.json({ error: "Gagal mengirim OTP" }, { status: 500 })
  }
}
