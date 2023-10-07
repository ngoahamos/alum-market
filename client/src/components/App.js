import { Route, Routes } from "react-router-dom";

import AuthProvider, { RequireAuth } from "../AuthProvider";
import Home from "./Home";
import Layout from "./Layout";
import Login from "./Login";
import Profile from "./Profile";
import AddItem from "./AddItem";

function App() {
  return (
    <AuthProvider>
        <Routes>
            <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<Home />} />
                <Route path="/messages" element={<div>Messages</div>} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/add" element={<AddItem />} />
            </Route>
            <Route path="/login" element={<Login />} />
        </Routes>
    </AuthProvider>
  );
}

export default App;
