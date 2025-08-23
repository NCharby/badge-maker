import { BadgeMakerTemplate } from '@/components/templates/BadgeMakerTemplate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'
import Link from 'next/link'

export function ConfirmationPage() {
  return (
    <BadgeMakerTemplate
      title="Badge Created Successfully!"
      subtitle="Your conference badge has been created and saved."
    >
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Your badge information has been stored in our database.
            You can now proceed with your conference registration.
          </p>

          <div className="flex justify-center space-x-4">
            <Link href="/">
              <Button variant="outline">
                Create Another Badge
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </BadgeMakerTemplate>
  )
}
