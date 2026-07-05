import { generateGeminiResponse } from "../Configs/gemini.js";
import User from "../Models/user.model.js";

// Universal page matcher - works for ANY configured page
const findMatchingPage = (pages, searchText) => {
  if (!searchText) return null;
  const search = searchText.toLowerCase();

  // Try 1: Match keywords
  let page = pages.find((p) =>
    (p.keywords || p.keyWords || []).some((kw) =>
      search.includes(kw.toLowerCase()),
    ),
  );
  if (page) return page;

  // Try 2: Match page name (e.g., "Pricing" → search contains "pricing")
  page = pages.find((p) => search.includes(p.name.toLowerCase()));
  if (page) return page;

  // Try 3: Match path word (e.g., /pricing → search contains "pricing", /features → search contains "features")
  page = pages.find((p) => {
    const pathWord = p.path.replace(/\//g, " ").toLowerCase();
    return (
      search.includes(pathWord) || search.includes(p.path.split("/")[1] || "")
    );
  });
  if (page) return page;

  // Try 4: Fuzzy match - if page name is short word, match if present (home, about, contact, etc.)
  page = pages.find((p) => {
    const name = p.name.toLowerCase();
    return name.length <= 10 && search.includes(name);
  });
  if (page) return page;

  return null;
};

export const getAssistantConfig = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-geminiApiKey");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Failed to Get user" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Assistant Config Data", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Assistant Config failed ${error}` });
  }
};

export const askAssistant = async (req, res) => {
  try {
    const startTime = Date.now();
    const { message, userId } = req.body;
    if (!message || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Message and userId are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not Found" });
    }

    if (!user.geminiApiKey) {
      return res
        .status(404)
        .json({ success: false, message: "Gemini API key is not added" });
    }

    if (
      user.plan === "free" &&
      Number(user.totalMessages) >= Number(user.requestLimit)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Free Limit reached" });
    }

    // If user is on pro and the pro expiry date has passed, downgrade to free (check only, save async)
    if (
      user.plan === "pro" &&
      user.proExpiresAt &&
      new Date(user.proExpiresAt) < new Date()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Pro Plan expired" });
    }

    const cleanMessage = message.toLowerCase();

    if (user.enableNavigation) {
      // Navigation commands
      const navigationWords = [
        "open",
        "go",
        "start",
        "show",
        "navigate",
        "take me",
      ];

      //Check navigation intent (match navigation words anywhere in the message)
      const wantsNavigation = navigationWords.some((word) =>
        cleanMessage.includes(word),
      );

      //User Wants Navigation
      if (wantsNavigation) {
        const matchPage = findMatchingPage(user.pages, cleanMessage);

        if (matchPage) {
          //Already Open
          if (req.body.currentPath === matchPage.path) {
            return res.json({
              success: true,
              response: `${matchPage.name} already open`,
            });
          }

          //Navigate
          return res.json({
            success: true,
            action: "navigate",
            path: matchPage.path,
            response: `Opening ${matchPage.name}`,
          });
        }
      }
    }

    const prompt = `

    Your are ${user.assistantName}
        
        Business Name: ${user.businessName}
        Business Type: ${user.businessType}
        Business Description: ${user.businessDescription}
        Assistant Tone: ${user.tone}

        Rules:
        - Keep replies under 15 words
        - Give fast direct responses
        - Talk naturally
        - Behave like smart voice assistant
        - Avoid long explanations
        - Keep responses short for quick voice playback

        User Question: ${message}
        `;

    const aiResponse = await generateGeminiResponse({
      prompt,
      apikey: user.geminiApiKey,
      user,
    });
    console.log(
      `Gemini response time: ${Date.now() - startTime}ms, length: ${aiResponse ? aiResponse.length : 0}`,
    );

    // If AI's reply indicates navigation, send immediately without waiting to save
    if (user.enableNavigation && aiResponse) {
      const navigationWords = [
        "open",
        "go",
        "start",
        "show",
        "navigate",
        "take me",
        "home",
        "dashboard",
      ];
      const aiLower = aiResponse.toLowerCase();
      const wantsNavigationFromAI = navigationWords.some((word) =>
        aiLower.includes(word),
      );
      if (wantsNavigationFromAI) {
        const matchPage = findMatchingPage(user.pages, aiResponse);

        if (matchPage) {
          if (req.body.currentPath === matchPage.path) {
            // Save async (don't wait)
            if (user.plan === "free") {
              user.totalMessages = (Number(user.totalMessages) || 0) + 1;
              user.save().catch((err) => console.error("Failed to save:", err));
            }
            return res.json({
              success: true,
              response: `${matchPage.name} already open`,
            });
          }

          // Save async (don't wait)
          if (user.plan === "free") {
            user.totalMessages = (Number(user.totalMessages) || 0) + 1;
            user.save().catch((err) => console.error("Failed to save:", err));
          }
          return res.json({
            success: true,
            action: "navigate",
            path: matchPage.path,
            response: aiResponse || `Opening ${matchPage.name}`,
          });
        }
      }
    }

    // Save message count async (don't wait)
    if (user.plan === "free") {
      user.totalMessages = (Number(user.totalMessages) || 0) + 1;
      user
        .save()
        .catch((err) => console.error("Failed to save message count:", err));
    }

    return res.json({
      success: true,
      aiResponse,
    });
  } catch (error) {
    console.error("askAssistant caught error:", error);

    return res
      .status(500)
      .json({ success: false, message: error.message || "Assistant AI Error" });
  }
};
