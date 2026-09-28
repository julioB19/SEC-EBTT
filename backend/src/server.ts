import app from "./app"

function server() {
    const port = Number(process.env.PORT) || 3333

    app.listen(port, () => console.log(`Running on http://localhost:${port}`))
}

server()
