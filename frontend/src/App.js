import React from "react"
import { Provider } from "./components/ui/provider"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import ApplicationPage from "./Pages/ApplicationPage"

const App = () => {
  return (
    <Provider> 
      <Router>
        <Routes>
          <Route path="/" element={<ApplicationPage />} />
        </Routes>
      </Router>
    </Provider>
  )
}

export default App



// import React from "react"
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
// import ApplicationPage from "./Pages/ApplicationPage"

// const App = () => {
//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<ApplicationPage />} />
//       </Routes>
//     </Router>
//   )
// }

// export default App
/////////////////////////////////////////////////////////////////
// import logo from './logo.svg';
// import './App.css';

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save now to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;

