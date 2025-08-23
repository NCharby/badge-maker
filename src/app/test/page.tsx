import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-foreground">shadcn/ui Test</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Test Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-input">Test Input</Label>
              <Input id="test-input" placeholder="Type something..." />
            </div>
            
            <div className="space-y-2">
              <Button variant="default">Default Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
