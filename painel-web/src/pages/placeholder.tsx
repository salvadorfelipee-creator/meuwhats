import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-screen items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Essa aba ainda está sendo portada pro layout novo.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Em breve essa tela vai ter o mesmo padrão visual da tela de Conversas.
        </CardContent>
      </Card>
    </div>
  )
}
