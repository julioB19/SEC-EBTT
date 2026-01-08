import app from "./app"

function server() {
    app.listen(3000, () => console.log("Running"))
}

server()