"use client"

import * as React from "react"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFolder3Line,
  RiGlobalLine,
  RiGoogleFill,
  RiLoader4Line,
  RiLockLine,
  RiLogoutBoxRLine,
  RiMore2Line,
  RiSearchLine,
  RiShieldKeyholeLine,
  RiUserLine,
} from "@remixicon/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { createSupabaseClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"

type PointerStyle = React.CSSProperties & {
  "--mx": string
  "--my": string
}

type VaultItem = {
  id: string
  title: string
  username: string
  password: string
  notes: string
  url: string
  updatedAt: string
  categoryId: string
  categoryName: string
  customFields: CustomField[]
  strength: "Strong" | "Medium" | "Weak"
}

type CustomField = {
  id: string
  label: string
  value: string
}

type Category = {
  id: string
  name: string
}

type SessionUser = {
  id: string
  email: string
}

type SupabaseBrowserClient = NonNullable<
  ReturnType<typeof createSupabaseClient>
>

const defaultCategories: Category[] = []
const defaultVaultItems: VaultItem[] = []

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
  const [sessionUser, setSessionUser] = React.useState<SessionUser | null>(null)
  const [pointer, setPointer] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    if (!supabase) return

    supabase.auth.getUser().then(({ data }) => {
      setSessionUser(
        data.user
          ? {
              id: data.user.id,
              email: data.user.email ?? "",
            }
          : null
      )
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? "",
            }
          : null
      )
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

  if (sessionUser && supabase) {
    return (
      <Dashboard
        supabase={supabase}
        user={sessionUser}
        onSignOut={handleSignOut}
      />
    )
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
                <CardTitle className="text-4xl font-semibold tracking-tight">
                  {mode === "login" ? "Welcome back!" : "Create account"}
                </CardTitle>
                <CardDescription className="text-base">
                  {mode === "login"
                    ? "Please enter your details"
                    : "Start your encrypted vault"}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-0">
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
                          mode === "login" ? "current-password" : "new-password"
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
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}

function Dashboard({
  supabase,
  user,
  onSignOut,
}: {
  supabase: SupabaseBrowserClient
  user: SessionUser
  onSignOut: () => void
}) {
  const [categories, setCategories] = React.useState(defaultCategories)
  const [vaultItems, setVaultItems] = React.useState(defaultVaultItems)
  const [newCategory, setNewCategory] = React.useState("")
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("")
  const [credentialUsername, setCredentialUsername] = React.useState("")
  const [credentialUrl, setCredentialUrl] = React.useState("")
  const [credentialPassword, setCredentialPassword] = React.useState("")
  const [credentialNotes, setCredentialNotes] = React.useState("")
  const [credentialCustomFields, setCredentialCustomFields] = React.useState<
    CustomField[]
  >([])
  const [dashboardError, setDashboardError] = React.useState("")
  const [dashboardStatus, setDashboardStatus] = React.useState("")
  const [loadingVault, setLoadingVault] = React.useState(true)
  const [savingCategory, setSavingCategory] = React.useState(false)
  const [savingCredential, setSavingCredential] = React.useState(false)
  const [credentialDialogOpen, setCredentialDialogOpen] = React.useState(false)

  const loadVaultData = React.useCallback(async () => {
    setDashboardError("")
    setLoadingVault(true)

    const [categoriesResult, credentialsResult] = await Promise.all([
      supabase
        .from("vault_categories")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("vault_credentials")
        .select(
          "id, title, username, password_encrypted, notes, custom_fields, website_url, updated_at, category_id, vault_categories(name)"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ])

    if (categoriesResult.error) {
      setDashboardError(categoriesResult.error.message)
      setLoadingVault(false)
      return
    }

    if (credentialsResult.error) {
      setDashboardError(credentialsResult.error.message)
      setLoadingVault(false)
      return
    }

    const nextCategories = (categoriesResult.data ?? []).map((category) => ({
      id: String(category.id),
      name: String(category.name),
    }))

    const nextVaultItems = (credentialsResult.data ?? []).map((credential) => {
      const categoryData = credential.vault_categories as
        | { name?: string | null }
        | { name?: string | null }[]
        | null
      const categoryName = Array.isArray(categoryData)
        ? categoryData[0]?.name
        : categoryData?.name

      return {
        id: String(credential.id),
        title: String(credential.title),
        username: credential.username ? String(credential.username) : "",
        password: credential.password_encrypted
          ? String(credential.password_encrypted)
          : "",
        notes: credential.notes ? String(credential.notes) : "",
        url: credential.website_url ? String(credential.website_url) : "",
        updatedAt: formatUpdatedAt(String(credential.updated_at)),
        categoryId: credential.category_id
          ? String(credential.category_id)
          : "",
        categoryName: categoryName ?? "Uncategorized",
        customFields: parseCustomFields(credential.custom_fields),
        strength: "Strong" as const,
      }
    })

    setCategories(nextCategories)
    setVaultItems(nextVaultItems)
    setSelectedCategoryId((current) => current || nextCategories[0]?.id || "")
    setLoadingVault(false)
  }, [supabase, user.id])

  React.useEffect(() => {
    loadVaultData()
  }, [loadVaultData])

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDashboardError("")
    setDashboardStatus("")

    const category = newCategory.trim()
    if (!category) return

    const existingCategory = categories.find(
      (item) => item.name.toLowerCase() === category.toLowerCase()
    )

    if (existingCategory) {
      setSelectedCategoryId(existingCategory.id)
      setNewCategory("")
      return
    }

    setSavingCategory(true)

    const { data, error } = await supabase
      .from("vault_categories")
      .insert({
        user_id: user.id,
        name: category,
      })
      .select("id, name")
      .single()

    setSavingCategory(false)

    if (error) {
      setDashboardError(error.message)
      return
    }

    if (data) {
      const nextCategory = {
        id: String(data.id),
        name: String(data.name),
      }

      setCategories((current) => [...current, nextCategory])
      setSelectedCategoryId(nextCategory.id)
      setNewCategory("")
      setDashboardStatus("Category created.")
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setDashboardError("")
    setDashboardStatus("")

    const { error: credentialsError } = await supabase
      .from("vault_credentials")
      .delete()
      .eq("user_id", user.id)
      .eq("category_id", categoryId)

    if (credentialsError) {
      setDashboardError(credentialsError.message)
      return
    }

    const { error: categoryError } = await supabase
      .from("vault_categories")
      .delete()
      .eq("user_id", user.id)
      .eq("id", categoryId)

    if (categoryError) {
      setDashboardError(categoryError.message)
      return
    }

    const nextCategories = categories.filter((item) => item.id !== categoryId)
    setCategories(nextCategories)
    setVaultItems((current) =>
      current.filter((item) => item.categoryId !== categoryId)
    )

    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(nextCategories[0]?.id ?? "")
    }

    setDashboardStatus("Category and its credentials deleted.")
  }

  async function handleCreateCredential(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setDashboardError("")
    setDashboardStatus("")

    const username = credentialUsername.trim()
    const websiteUrl = credentialUrl.trim()
    const accountPassword = credentialPassword.trim()
    const notes = credentialNotes.trim()
    const title = username || websiteUrl || "Credential"
    const customFields = credentialCustomFields
      .map((field) => ({
        id: field.id,
        label: field.label.trim(),
        value: field.value.trim(),
      }))
      .filter((field) => field.label || field.value)

    if (!accountPassword || !selectedCategoryId) return

    const selectedCategory = categories.find(
      (category) => category.id === selectedCategoryId
    )

    setSavingCredential(true)

    const { data, error } = await supabase
      .from("vault_credentials")
      .insert({
        user_id: user.id,
        category_id: selectedCategoryId,
        title,
        username,
        website_url: websiteUrl,
        password_encrypted: accountPassword,
        notes,
        custom_fields: customFields,
      })
      .select(
        "id, title, username, password_encrypted, notes, custom_fields, website_url, updated_at, category_id"
      )
      .single()

    setSavingCredential(false)

    if (error) {
      setDashboardError(error.message)
      return
    }

    if (data) {
      const nextCredential = {
        id: String(data.id),
        title: String(data.title),
        username: data.username ? String(data.username) : "",
        password: data.password_encrypted
          ? String(data.password_encrypted)
          : "",
        notes: data.notes ? String(data.notes) : "",
        url: data.website_url ? String(data.website_url) : "",
        updatedAt: formatUpdatedAt(String(data.updated_at)),
        categoryId: data.category_id ? String(data.category_id) : "",
        categoryName: selectedCategory?.name ?? "Uncategorized",
        customFields: parseCustomFields(data.custom_fields),
        strength: "Strong" as const,
      }

      setVaultItems((current) => [nextCredential, ...current])
      setCredentialUsername("")
      setCredentialUrl("")
      setCredentialPassword("")
      setCredentialNotes("")
      setCredentialCustomFields([])
      setCredentialDialogOpen(false)
      setDashboardStatus("Credential saved.")
    }
  }

  const categoryCounts = categories.map((category) => ({
    ...category,
    count: vaultItems.filter((item) => item.categoryId === category.id).length,
  }))

  const selectedCategoryName =
    categories.find((category) => category.id === selectedCategoryId)?.name ??
    ""
  const visibleVaultItems = selectedCategoryId
    ? vaultItems.filter((item) => item.categoryId === selectedCategoryId)
    : []

  function handleCredentialDialogOpenChange(open: boolean) {
    setCredentialDialogOpen(open)

    if (open) {
      setCredentialUsername("")
      setCredentialUrl("")
      setCredentialPassword("")
      setCredentialNotes("")
      setCredentialCustomFields([])
    }
  }

  function handleAddCustomField() {
    setCredentialCustomFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "",
        value: "",
      },
    ])
  }

  function handleUpdateCustomField(
    id: string,
    key: "label" | "value",
    value: string
  ) {
    setCredentialCustomFields((current) =>
      current.map((field) =>
        field.id === id
          ? {
              ...field,
              [key]: value,
            }
          : field
      )
    )
  }

  function handleRemoveCustomField(id: string) {
    setCredentialCustomFields((current) =>
      current.filter((field) => field.id !== id)
    )
  }

  return (
    <main className="min-h-svh bg-muted p-3 text-foreground md:p-5">
      <section className="min-h-[calc(100svh-1.5rem)] overflow-hidden rounded-3xl bg-background shadow-sm ring-1 ring-border md:min-h-[calc(100svh-2.5rem)]">
        <header className="flex flex-col gap-4 border-b border-border px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
              <RiShieldKeyholeLine className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                MarkBook
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog
              open={credentialDialogOpen}
              onOpenChange={handleCredentialDialogOpenChange}
            >
              <DialogTrigger
                render={
                  <Button size="sm">
                    <RiAddLine className="size-4" />
                    Add password
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New credential</DialogTitle>
                  <DialogDescription>
                    Save account credentials to Supabase.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-3" onSubmit={handleCreateCredential}>
                  <Input
                    value={credentialUrl}
                    onChange={(event) => setCredentialUrl(event.target.value)}
                    placeholder="URL"
                    type="url"
                  />
                  <Input
                    value={credentialUsername}
                    onChange={(event) =>
                      setCredentialUsername(event.target.value)
                    }
                    placeholder="Username or email"
                    autoComplete="off"
                    name="credential-username"
                  />
                  <Input
                    value={credentialPassword}
                    onChange={(event) =>
                      setCredentialPassword(event.target.value)
                    }
                    placeholder="Password"
                    type="password"
                    autoComplete="new-password"
                    name="credential-password"
                    required
                  />
                  <textarea
                    value={credentialNotes}
                    onChange={(event) => setCredentialNotes(event.target.value)}
                    placeholder="Notes"
                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Custom fields</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddCustomField}
                      >
                        <RiAddLine className="size-4" />
                        Add field
                      </Button>
                    </div>
                    {credentialCustomFields.length > 0 ? (
                      <div className="grid gap-2">
                        {credentialCustomFields.map((field) => (
                          <div
                            key={field.id}
                            className="grid grid-cols-[1fr_1fr_auto] gap-2"
                          >
                            <Input
                              value={field.label}
                              onChange={(event) =>
                                handleUpdateCustomField(
                                  field.id,
                                  "label",
                                  event.target.value
                                )
                              }
                              placeholder="Field name"
                            />
                            <Input
                              value={field.value}
                              onChange={(event) =>
                                handleUpdateCustomField(
                                  field.id,
                                  "value",
                                  event.target.value
                                )
                              }
                              placeholder="Value"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCustomField(field.id)}
                              aria-label="Remove custom field"
                            >
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Add fields like recovery email, PIN, token, or security
                        question.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="credential-category">Category</Label>
                    <Select
                      value={selectedCategoryId}
                      onValueChange={(value) => {
                        if (value) setSelectedCategoryId(value)
                      }}
                      disabled={categories.length === 0}
                    >
                      <SelectTrigger
                        id="credential-category"
                        className="h-10 w-full"
                      >
                        <span
                          className={cn(
                            "flex flex-1 text-left",
                            !selectedCategoryName && "text-muted-foreground"
                          )}
                        >
                          {selectedCategoryName || "Choose category"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !selectedCategoryId ||
                      !credentialPassword.trim() ||
                      savingCredential
                    }
                  >
                    {savingCredential ? (
                      <RiLoader4Line className="size-4 animate-spin" />
                    ) : (
                      <RiAddLine className="size-4" />
                    )}
                    Save credential
                  </Button>
                  {selectedCategoryName ? (
                    <p className="text-xs text-muted-foreground">
                      Saving into {selectedCategoryName}.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Create a category before saving credentials.
                    </p>
                  )}
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <RiLogoutBoxRLine className="size-4" />
              Sign out
            </Button>
          </div>
        </header>

        {dashboardError || dashboardStatus ? (
          <div className="px-5 pt-4 md:px-8">
            {dashboardError ? (
              <p className="text-sm text-destructive">{dashboardError}</p>
            ) : null}
            {dashboardStatus ? (
              <p className="text-sm text-muted-foreground">{dashboardStatus}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 px-5 pt-4 pb-5 md:px-8 md:pt-5 md:pb-8 xl:grid-cols-[16rem_1fr]">
          <aside className="grid content-start gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categories</CardTitle>
                <CardDescription>
                  Create groups for accounts and credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <form className="flex gap-2" onSubmit={handleCreateCategory}>
                  <Input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="New category"
                    aria-label="New category"
                    disabled={savingCategory}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Create category"
                    disabled={savingCategory || !newCategory.trim()}
                  >
                    {savingCategory ? (
                      <RiLoader4Line className="size-4 animate-spin" />
                    ) : (
                      <RiAddLine className="size-4" />
                    )}
                  </Button>
                </form>

                <div className="grid gap-1">
                  {categoryCounts.map((category) => (
                    <div
                      key={category.id}
                      className={cn(
                        "grid grid-cols-[1fr_auto] items-center gap-1 rounded-md transition-colors hover:bg-muted",
                        selectedCategoryId === category.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <RiFolder3Line className="size-4 shrink-0" />
                          <span className="truncate">{category.name}</span>
                        </span>
                        <span className="text-xs">{category.count}</span>
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mr-1 size-8 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${category.name}`}
                            >
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete {category.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will also delete {category.count} credential
                              {category.count === 1 ? "" : "s"} in this
                              category.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCategory(category.id)}
                            >
                              Delete category
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
                {categories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No categories yet.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security overview</CardTitle>
                <CardDescription>
                  Quick status for your saved credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Stat
                  label="Saved accounts"
                  value={String(vaultItems.length)}
                />
                <Stat label="Categories" value={String(categories.length)} />
                <Stat
                  label="Needs review"
                  value={String(
                    vaultItems.filter((item) => item.strength !== "Strong")
                      .length
                  )}
                />
              </CardContent>
            </Card>
          </aside>

          <section className="grid content-start gap-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Password vault
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage synced accounts after signing in.
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search accounts"
                  className="h-10 pl-9"
                  aria-label="Search accounts"
                />
              </div>
            </div>

            <Card className="overflow-hidden py-0">
              <CardContent className="p-0">
                {loadingVault ? (
                  <div className="grid min-h-56 place-items-center px-6 py-10 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <RiLoader4Line className="size-4 animate-spin" />
                      Loading vault...
                    </span>
                  </div>
                ) : visibleVaultItems.length > 0 ? (
                  <div className="divide-y divide-border">
                    {visibleVaultItems.map((item) => (
                      <VaultRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
                    <div className="grid max-w-sm gap-2">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <RiShieldKeyholeLine className="size-5" />
                      </div>
                      <h3 className="font-medium">No credentials yet</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedCategoryName
                          ? `No credentials saved in ${selectedCategoryName}.`
                          : "Create a category first, then save account credentials into that category."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </section>
    </main>
  )
}

function VaultRow({ item }: { item: VaultItem }) {
  return (
    <article className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-start md:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <RiGlobalLine className="size-5" />
        </div>
        <div className="grid min-w-0 gap-3">
          <div>
            <h3 className="truncate font-medium">{item.title}</h3>
            {item.notes ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {item.notes}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="Username" value={item.username} />
            <DetailItem label="Password" value={item.password} isSecret />
            <DetailItem label="URL" value={item.url} />
            <DetailItem label="Category" value={item.categoryName} />
            <DetailItem label="Updated" value={item.updatedAt} />
            {item.customFields.map((field) => (
              <DetailItem
                key={field.id}
                label={field.label || "Custom field"}
                value={field.value}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            item.strength === "Strong"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          )}
        >
          {item.strength}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!item.username}
              onClick={() => navigator.clipboard.writeText(item.username)}
            >
              <RiFileCopyLine className="size-4" />
              Copy username
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!item.password}
              onClick={() => navigator.clipboard.writeText(item.password)}
            >
              <RiFileCopyLine className="size-4" />
              Copy password
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!item.url}
              onClick={() => navigator.clipboard.writeText(item.url)}
            >
              <RiFileCopyLine className="size-4" />
              Copy URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

function DetailItem({
  label,
  value,
  isSecret,
}: {
  label: string
  value: string
  isSecret?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/35 px-3 py-2">
      <div className="text-[11px] font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-sm",
          isSecret ? "font-semibold text-foreground" : "text-foreground"
        )}
      >
        {value || "-"}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Just now"
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date)
}

function parseCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((field, index) => {
      if (!field || typeof field !== "object") {
        return null
      }

      const data = field as {
        id?: unknown
        label?: unknown
        value?: unknown
      }
      const label = typeof data.label === "string" ? data.label : ""
      const fieldValue = typeof data.value === "string" ? data.value : ""

      if (!label && !fieldValue) {
        return null
      }

      return {
        id: typeof data.id === "string" ? data.id : `custom-${index}`,
        label,
        value: fieldValue,
      }
    })
    .filter((field): field is CustomField => field !== null)
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
