'use client'

import { useState, useEffect } from 'react'
import { User, LogOut, Clock, Shield, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore, authSelectors, useSDKStore, sdkSelectors } from '@/stores'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function UserProfile() {
  const userInfo = useAuthStore(authSelectors.userInfo)
  const logout = useAuthStore((state) => state.logout)
  const client = useSDKStore(sdkSelectors.client)
  const [tokenInfo, setTokenInfo] = useState<any>(null)

  useEffect(() => {
    const loadTokenInfo = async () => {
      try {
        // Check if the new SDK methods are available
        if (typeof client.getToken === 'function') {
          const token = await client.getToken()
          if (token) {
            setTokenInfo(token)
          }
        }
      } catch (error) {
        // Silent fail - token might not be available
        setTokenInfo(null)
      }
    }

    loadTokenInfo()
  }, [client])

  const handleLogout = async () => {
    await logout()
  }

  if (!userInfo) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not authenticated</p>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (date: Date) => {
    return date.toLocaleString()
  }

  const isTokenExpiringSoon = () => {
    if (!userInfo.expiresAt) return false
    const now = new Date()
    const fiveMinutes = 5 * 60 * 1000
    return userInfo.expiresAt.getTime() - now.getTime() < fiveMinutes
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User UUID */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            User ID
          </label>
          <p className="font-mono text-sm break-all">{userInfo.userUUID}</p>
        </div>

        {/* Authorities */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Authorities
          </label>
          <div className="flex flex-wrap gap-1 mt-1">
            {userInfo.authorities.length > 0 ? (
              userInfo.authorities.map((authority: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {authority}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-xs">
                No authorities
              </Badge>
            )}
          </div>
        </div>

        {/* Account Status */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            {userInfo.enabled ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">
              {userInfo.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {userInfo.accountNonLocked ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">
              {userInfo.accountNonLocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>
        </div>

        {/* Token Expiration */}
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Token Expires
          </label>
          <p className="text-sm">
            {formatDate(userInfo.expiresAt)}
            {isTokenExpiringSoon() && (
              <Badge variant="destructive" className="ml-2 text-xs">
                Expiring Soon
              </Badge>
            )}
          </p>
        </div>

        {/* Token Issued */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Token Issued
          </label>
          <p className="text-sm">{formatDate(userInfo.issuedAt)}</p>
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full mt-4"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </CardContent>
    </Card>
  )
}

export default UserProfile
