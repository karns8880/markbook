"use client"

import * as React from "react"
import {
  RiEyeLine,
  RiEyeOffLine,
  RiGoogleFill,
  RiLoader4Line,
  RiLockLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"

type PointerStyle = React.CSSProperties & {
  "--mx": string
  "--my": string
}

export default function Page() {
  const supabase = React.useMemo(() => createSupabaseClient(), [])
  const [mode, setMode] = React.useState<AuthMode>("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [remember, setRemember] = React.useState(true)
  const [status, setStatus] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sessionEmail, setSessionEmail] = React.useState<string | null>(null)
  const [pointer, setPointer] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    if (!supabase) return

    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  function handlePointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setStatus("")

    if (!supabase) {
      setError("缺少 Supabase 环境变量。请检查 .env.dev 或 .env.local。")
      return
    }

    setLoading(true)
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        setStatus(
          remember ? "登录成功" : "登录成功。本次会话结束后请手动退出。"
        )
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        setStatus("注册成功。如果开启邮箱确认，请先查看邮箱。")
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "认证失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError("")
    setStatus("")

    if (!supabase) {
      setError("缺少 Supabase 环境变量。请检查 .env.dev 或 .env.local。")
      return
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
    }
  }

  async function handleResetPassword() {
    setError("")
    setStatus("")

    if (!supabase) {
      setError("缺少 Supabase 环境变量。请检查 .env.dev 或 .env.local。")
      return
    }

    if (!email) {
      setError("请先输入邮箱")
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin,
      }
    )

    if (resetError) {
      setError(resetError.message)
      return
    }

    setStatus("重置密码邮件已发送")
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setStatus("")
    setError("")
  }

  const pointerStyle: PointerStyle = {
    "--mx": pointer.x.toFixed(3),
    "--my": pointer.y.toFixed(3),
  }

  return (
    <main className="min-h-svh bg-muted p-3 text-foreground md:p-5">
      <section className="grid min-h-[calc(100svh-1.5rem)] overflow-hidden rounded-3xl bg-background shadow-sm ring-1 ring-border md:min-h-[calc(100svh-2.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="relative hidden overflow-hidden bg-muted lg:block"
          onMouseMove={handlePointerMove}
          style={pointerStyle}
        >
          <div className="pointer-glow absolute inset-0" />
          <div className="absolute inset-x-10 top-10 bottom-10 rounded-[2rem] border border-border/70 bg-background/30" />
          <AnimatedCharacters />
        </div>

        <div className="flex min-h-[calc(100svh-1.5rem)] items-center justify-center px-5 py-10 md:min-h-[calc(100svh-2.5rem)] md:px-8">
          <div className="w-full max-w-md">
            <Card className="border-0 bg-transparent py-0 shadow-none ring-0">
              <CardHeader className="items-center px-0 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-foreground text-background">
                  <RiLockLine className="size-5" />
                </div>
                <CardTitle className="font-heading text-4xl font-semibold tracking-tight">
                  {sessionEmail
                    ? "已登录"
                    : mode === "login"
                      ? "Welcome back!"
                      : "Create account"}
                </CardTitle>
                <CardDescription className="text-base">
                  {sessionEmail
                    ? sessionEmail
                    : mode === "login"
                      ? "Please enter your details"
                      : "Start your encrypted vault"}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-0">
                {sessionEmail ? (
                  <div className="grid gap-4">
                    <Button size="lg" onClick={handleSignOut}>
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <form className="grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="anna@gmail.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-12 rounded-none border-x-0 border-t-0 px-0 text-lg shadow-none focus-visible:ring-0"
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label
                        htmlFor="password"
                        className={cn(error ? "text-destructive" : undefined)}
                      >
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder="••••••••••"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          className="h-12 rounded-none border-x-0 border-t-0 px-0 pr-11 text-lg shadow-none focus-visible:ring-0"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 right-0 -translate-y-1/2"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "隐藏密码" : "显示密码"}
                        >
                          {showPassword ? (
                            <RiEyeOffLine className="size-4" />
                          ) : (
                            <RiEyeLine className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <Checkbox
                          checked={remember}
                          onCheckedChange={(checked) =>
                            setRemember(checked === true)
                          }
                        />
                        Remember for 30 days
                      </label>
                      <button
                        type="button"
                        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        onClick={handleResetPassword}
                      >
                        Forgot password?
                      </button>
                    </div>

                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                    {status ? (
                      <p className="text-sm text-muted-foreground">{status}</p>
                    ) : null}

                    <Button type="submit" size="lg" disabled={loading}>
                      {loading ? (
                        <RiLoader4Line className="size-4 animate-spin" />
                      ) : null}
                      {mode === "login" ? "Log in" : "Sign up"}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={handleGoogleLogin}
                    >
                      <RiGoogleFill className="size-5 text-[#4285f4]" />
                      Log in with Google
                    </Button>

                    <p className="pt-12 text-center text-sm text-muted-foreground">
                      {mode === "login"
                        ? "Don't have an account?"
                        : "Already have an account?"}{" "}
                      <button
                        type="button"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        onClick={() => {
                          setMode(mode === "login" ? "signup" : "login")
                          setError("")
                          setStatus("")
                        }}
                      >
                        {mode === "login" ? "Sign Up" : "Log in"}
                      </button>
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}

function AnimatedCharacters() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="shape shape-purple">
        <Eyes expression="sad" />
      </div>
      <div className="shape shape-dark">
        <Eyes />
      </div>
      <div className="shape shape-yellow">
        <Eyes expression="flat" />
      </div>
      <div className="shape shape-orange">
        <Eyes expression="sad" />
      </div>
    </div>
  )
}

function Eyes({
  expression = "soft",
}: {
  expression?: "soft" | "sad" | "flat"
}) {
  return (
    <div className="eyes">
      <span />
      <span />
      <i data-expression={expression} />
    </div>
  )
}
