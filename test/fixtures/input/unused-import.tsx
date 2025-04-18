// Misc
import React            from 'react';
import {
    useRef,
    useState,
    useEffect
}                       from 'react';
import { ParserResult } from 'tidyjs-parser';
import { Uri } from 'vscode';

const ACONST = "detected as false positive import";

type Props = {
  uri: Uri;
};

const DiagnosticChecker: React.FC<Props> = ({ uri }) => {
  useEffect(() => {
    // Simulate a delay to mimic an async operation
    const timeoutId = setTimeout(() => {
      // This is where you would typically fetch or process the data
      console.log("Processing URI:", uri);
    }, 1000);

    // Cleanup function to clear the timeout if the component unmounts
    return () => {
      clearTimeout(timeoutId);
    };
  }, [uri]);

  // Juste pour utiliser ParserResult
  const dummyParser: ParserResult = {
    groups: [],
    originalImports: [],
    invalidImports: [],
  };

  return (
    <div ref={div}>
      <h2>Diagnostics Checker</h2>
      <pre>{JSON.stringify(dummyParser, null, 2)}</pre>
    </div>
  );
};

export default DiagnosticChecker;
