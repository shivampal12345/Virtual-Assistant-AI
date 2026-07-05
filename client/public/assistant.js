(function () {
  // userData
  const script = document.currentScript;

  const userId = script?.dataset?.userId;
  // console.log(userId)
  const theme = "dark";

  let assistantConfig = null;

  //load CSS

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://virtual-assistant-ai-5fg6.onrender.com/assistant.css";

  document.head.appendChild(link);

  // Create a Popup

  const popup = document.createElement("div");
  popup.className = `jarvis-popup theme-${theme}`;
  popup.innerHTML = `
     <div class="jarvis-overlay"></div>


     <div class="jarvis-content">
     
       <div class="jarvis-top">

          <div class="jarvis-orb-wrap">
     
              <div class="jarvis-orb-glow"></div>
              <div class="jarvis-orb"></div>

      </div>
    <h2 class="jarvis-title">
       Hello! I'm Jarvis AI
    </h2>

    <p class = "jarvis-sub">
    Your Smart Voice Assistant.
    <br/>
    Ask Anything About Your Website.
    </p>

    <div class="jarvis-status">
    Tap Button to Speak</div>

    <div class="jarvis-wave">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    </div>

    <!-- User Text -->
        <div class="jarvis-user-text"></div>
    
    <!-- AI Text -->
        <div class="jarvis-ai-text"></div>    

     </div>

     <div class="jarvis-bottom">

        <button class="jarvis-mic">

            <img src="https://virtual-assistant-ai-5fg6.onrender.com/mic.svg" alt="mic" class="jarvis-mic-icon"/>

        </button>

     </div>

     </div>
     `;

     document.body.appendChild(popup);

     //floating button
     const button = document.createElement("button")
    button.className = `jarvis-btn theme-${theme}`

    button.innerHTML = `<img src= "https://virtual-assistant-ai-5fg6.onrender.com/logo.png" alt="logo"/>`
    document.body.appendChild(button)

    //toggle popup
    let open = false;
    
    button.onclick = () => {
        open = !open
        popup.style.display = open ? "flex" : "none"
    }

    // load Assistant
    const loadAssistant = async() => {
        try {
            const res = await fetch(`https://virtual-assistant-ai-server.onrender.com/api/assistant/config/${userId}`)
            const data = await res.json()

            // console.log(data)

            if(data) {
                assistantConfig = data.user
                applyConfig()
            }
        } catch (error) {
            console.log("Assistant Load error:", error)
        }
    }

    const applyConfig = () => {
        if(!assistantConfig) return

        popup.className = `jarvis-popup theme-${assistantConfig.theme}`
        button.className = `jarvis-btn theme-${assistantConfig.theme}`

        const title = popup.querySelector(".jarvis-title")
        title.innerHTML = `Hello I'm ${assistantConfig.assistantName}`

        const subTitle = popup.querySelector(".jarvis-sub")
        subTitle.innerHTML = `Welcome to ${assistantConfig.businessName} <br/> Ask Anything about your Website.`
    }

    loadAssistant()

    // Element
    const status = popup.querySelector(".jarvis-status")
    const wave = popup.querySelector(".jarvis-wave")
    const userText = popup.querySelector(".jarvis-user-text")
    const aiText = popup.querySelector(".jarvis-ai-text")
    const mic = popup.querySelector(".jarvis-mic")

    //text-speech

    const speak = (text) => {
        window.speechSynthesis.cancel();

        //Show AI response
        aiText.innerText = text;
        status.innerText = "AI Speaking...";

        const speech = new SpeechSynthesisUtterance(text)
        
        speech.lang = "hi-IN";
        speech.rate = 1;
        speech.pitch = 1;
        speech.volume = 1;

        //Voice End
        speech.onend = () => {
            status.innerText = "Tap button to Speak"
            wave.style.opacity = "0"
        };

        //Start Speaking
        window.speechSynthesis.speak(speech);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if(SpeechRecognition) {
        const recognition = new SpeechRecognition();

        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        let isListening = false;
        let listenTimeout;

        mic.onclick = () => {
            // Prevent multiple clicks
            if(isListening) {
                console.log('Already listening...');
                return;
            }
            
            isListening = true;
            clearTimeout(listenTimeout);
            
            wave.style.opacity = "1";
            status.innerText = "Listening....";
            userText.innerText = "";
            aiText.innerText = "";

            try {
                recognition.start();
                // Auto-stop after 10 seconds of no input
                listenTimeout = setTimeout(() => {
                    if(isListening) {
                        recognition.abort();
                        isListening = false;
                        status.innerText = "No speech detected. Try again.";
                        wave.style.opacity = "0";
                    }
                }, 10000);
            } catch (err) {
                console.error('Failed to start recognition:', err);
                status.innerText = "Microphone error. Try again.";
                wave.style.opacity = "0";
                isListening = false;
            }
        }

        recognition.onstart = () => {
            console.log('Speech recognition started');
        };

        recognition.onresult = (e) => {
            clearTimeout(listenTimeout);
            
            if(!e.results.length) return;
            
            const text = e.results[0][0].transcript;
            userText.innerText = "You: " + text;
            isListening = false;
            recognition.stop();

            setTimeout(async() => {
                try {
                    status.innerText = "Thinking...";

                    const res = await fetch("https://virtual-assistant-ai-server.onrender.com/api/assistant/ask",{
                        method:"POST",
                        headers: {
                            "Content-Type" : "application/json"
                        },
                        body: JSON.stringify({
                            message: text,
                            userId,
                            currentPath: window.location.pathname
                        })
                    })

                    const data = await res.json()
                    console.log(data)

                    if(data.success){
                        if(data.action === "navigate"){
                            speak(data.response)
                            setTimeout(()=>{
                                window.location.href = data.path
                            },1500)
                        }else {
                            speak(data.aiResponse)
                        }
                    }else {
                        speak(data.message || "Response Error Please Check your Plan")
                    }
                } catch (error) {
                    console.error(error)
                    speak("Server Error")
                }
            },600)
        }

        recognition.onerror = (event) => {
            clearTimeout(listenTimeout);
            isListening = false;
            
            const errorMap = {
                'no-speech': 'No speech detected. Please try again.',
                'audio-capture': 'No microphone found. Check permissions.',
                'network': 'Network error. Check connection.',
                'permission-denied': 'Microphone permission denied.',
                'not-allowed': 'Microphone access not allowed.',
                'service-not-allowed': 'Speech recognition not available.'
            };
            
            const errorMsg = errorMap[event.error] || `Error: ${event.error}`;
            console.error('Speech recognition error:', event.error, errorMsg);
            status.innerText = errorMsg;
            wave.style.opacity = "0";
        }

        recognition.onend = () => {
            clearTimeout(listenTimeout);
            isListening = false;
            console.log('Speech recognition ended');
        };

    }else{
        status.innerText = "Speech Recognition not Supported"
    }

})();
