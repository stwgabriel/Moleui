// Simple test version of App to verify React + Tailwind is working
// Replace App.tsx content with this temporarily if you see blank screens

function AppTest() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">🎉 Moleui Desktop</h1>
        <p className="text-xl mb-8">React + TypeScript + Tailwind CSS is working!</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">✅ React</h2>
            <p>Component rendering works</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">✅ Tailwind</h2>
            <p>Utility classes are applied</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">✅ TypeScript</h2>
            <p>Type checking enabled</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">✅ Vite</h2>
            <p>Fast build system</p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-yellow-500/20 rounded-xl border border-yellow-500/50">
          <h3 className="text-xl font-semibold mb-2">⚠️ Test Mode</h3>
          <p>If you see this, the basic setup is working!</p>
          <p className="mt-2 text-sm">Replace App.tsx with the full version to continue.</p>
        </div>
      </div>
    </div>
  );
}

export default AppTest;
