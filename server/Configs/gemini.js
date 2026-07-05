const Gemini_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

export const generateGeminiResponse = async ({ prompt, apikey, user }) => {
  try {
    if (!apikey) {
      throw new Error("Gemini API key missing");
    }

    const response = await fetch(`${Gemini_URL}?key=${apikey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if(!response.ok){
      // Invalid API key
      if(response.status === 400 || response.status === 401){
        user.geminiStatus = "invalid"
        await user.save()
      }
      // Quota Exceeded
      if(response.status === 429) {
        user.geminiStatus = "quota_exceeded"
        await user.save()
      }

      const err = await response.text()
      console.error("Gemini API response error:", response.status, err)
      throw new Error(`Gemini API error (${response.status}): ${err || response.statusText}`);
    }
    //success status
    user.geminiStatus = "active";
    await user.save()

    const data = await response.json()
    // console.log(data)

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text){
        throw new Error("No text returned from Gemini")
    }

    return text.trim()
  } catch (error) {
    console.error("Gemini fetch Error:", error)
    throw new Error(error.message || "Gemini API fetch failed")
  }
};
