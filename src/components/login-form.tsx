import * as React from "react"
import { useState } from "react"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface LoginFormProps extends React.ComponentPropsWithoutRef<"form"> {
  onSubmitLogin?: (username: string, password: string, rememberMe: boolean) => Promise<void> | void
  isLoading?: boolean
  error?: string | null
  defaultUsername?: string
}

export function LoginForm({
  className,
  onSubmitLogin,
  isLoading = false,
  error,
  defaultUsername = "",
  ...props
}: LoginFormProps) {
  const [username, setUsername] = useState(defaultUsername)
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (onSubmitLogin) {
      onSubmitLogin(username, password, rememberMe)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Login to your account</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Enter your username or email below to access your dashboard
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username">Username or Email</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Admin or admin@kitchenbots.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="username"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="#forgot-password"
              onClick={(e) => {
                e.preventDefault()
                alert("Please contact your system administrator to reset your credentials.")
              }}
              className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-primary"
            >
              Forgot your password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
          />
          <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
            Remember this session
          </Label>
        </div>

        <Button type="submit" className="w-full font-medium" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "Signing in..." : "Login"}
        </Button>
      </div>
    </form>
  )
}
