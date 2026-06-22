import { Router as WouterRouter, Route, Switch } from "wouter";
import GestureControl from "@/pages/GestureControl";

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={GestureControl} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
