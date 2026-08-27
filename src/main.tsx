import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { DevEmails } from "./pages/DevEmails";
import { Feed } from "./pages/Feed";
import { Home } from "./pages/Home";
import { Manifesto } from "./pages/Manifesto";
import { Rules } from "./pages/Rules";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="feed" element={<Feed />} />
          <Route path="rules" element={<Rules />} />
          <Route path="manifesto" element={<Manifesto />} />
          <Route path="why" element={<Navigate to="/manifesto" replace />} />
          <Route path="about" element={<About />} />
          <Route path="dev/emails" element={<DevEmails />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
