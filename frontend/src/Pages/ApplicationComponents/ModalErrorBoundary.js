import React from "react";
import { modalStyles as styles } from "./caseGroupModalStyles";

// Keeps a crash inside a case group window from blanking the whole consultant page
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Case group window crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={styles.overlay}>
        <div style={styles.modal} role="alertdialog" aria-label="Something went wrong">
          <h2 style={styles.title}>Something went wrong in this window</h2>
          <p>The rest of the page still works. Close this window and try again, or refresh the page.</p>
          <div style={styles.actions}>
            <button onClick={this.props.onClose} style={styles.primaryButton}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ModalErrorBoundary;
