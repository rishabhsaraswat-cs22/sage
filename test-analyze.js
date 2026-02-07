/**
 * Test script for the /v4/analyze-session endpoint
 * Uses the latest GD session from logs/gd_session.log
 */

const fs = require('fs');

// Sample transcript from the last complete session in gd_session.log
const testData = {
    topic: "In today's innovation landscape, should societal and ethical impact be considered as crucial a metric for startup success as financial viability?",
    userName: "Rudra",
    totalDuration: "8m 15s",
    participantCount: 5,
    transcript: [
        {
            speaker: "AI_1",
            text: "Good morning, everyone. The topic for our discussion is whether societal and ethical impact should be considered as crucial a metric for a startup's success as its financial viability. This is particularly relevant today, as rapid technological advancements from startups are having a profound effect on our society, leading to greater scrutiny of their real-world consequences. This creates a fundamental tension between the traditional push for aggressive growth and profit, and the growing demand for responsible innovation."
        },
        {
            speaker: "AI_2",
            text: "I believe we're past the point of this being a choice. Societal and ethical impact is no longer a 'soft' metric; it's a lead indicator of long-term financial health. Startups that ignore their impact are accumulating a form of 'ethical debt' that will eventually come due, whether through consumer backlash, regulatory scrutiny, or an inability to attract top talent. It's a direct risk to viability."
        },
        {
            speaker: "AI_3",
            text: "I'd argue we're looking at a false dichotomy here. In the long run, I don't believe sustainable financial viability is even possible *without* a positive societal impact. A business model that creates significant negative externalities, whether harming user well-being or the environment, is inherently unstable. It's just a matter of time before that ethical debt comes due."
        },
        {
            speaker: "AI_4",
            text: "I see the point about 'ethical debt', but the core challenge here is measurement. Financial viability is tracked with universally accepted KPIs like revenue, profit, and burn rate. What is the equivalent for societal impact? Without a concrete, standardized framework to quantify it, elevating it to the same level as financial success remains an abstract ideal rather than an actionable business metric."
        },
        {
            speaker: "AI_1",
            text: "I don't fully agree with the 'false dichotomy' framing. While that long-term alignment is the ideal, an early-stage startup's reality is short-term survival. Founders are forced to prioritize metrics that secure the next funding round, which can create a very real trade-off between surviving today and perfecting their societal impact for tomorrow."
        },
        {
            speaker: "User",
            text: "I want to push back slightly from a startup lens. The real issue isn't philosophy. It's a sequencing early stage startups, live or die by speed to product Market fit if you overload them, with impact constants, before the model stabilizes, you risk. Killing a good idea on paper. Ground reality is first to prove viability, then you initialize impact. Otherwise, we have mixing survival metrics with maturity metrics."
        },
        {
            speaker: "AI_2",
            text: "I think we're framing this as an 'either/or' when it doesn't have to be. For a new wave of startups, the business model *is* the impact model. Think of a company creating affordable diagnostics for rural areas or one turning waste into energy. Their revenue is directly proportional to their positive contribution."
        },
        {
            speaker: "AI_3",
            text: "Building on Parth's point about funding, let's not place the entire burden on the founder. The real bottleneck is the venture capital model itself. As long as LPs and VCs exclusively prize hyper-growth financial returns and ignore impact as a risk or value driver, founders are simply responding to the incentives they're given."
        },
        {
            speaker: "AI_4",
            text: "Building on Parth's point about funding, let's be realistic about the ecosystem. The entire venture capital model is predicated on hyper-growth and financial returns, not societal good. The metrics that get a founder from a Seed to a Series A round are traction and revenue, not impact scores."
        },
        {
            speaker: "AI_1",
            text: "I think the challenge is even more fundamental than the VC model; it's about how we define 'impact' itself. We're talking about positive contributions, but what about negative externalities? A startup can have great financials but create huge societal costs—like gig economy platforms impacting worker security. True success must also mean minimizing harm."
        },
        {
            speaker: "User",
            text: "I want to push back on the idea that impact Native models generalized. They work well in sectors where value creation and social good naturally aligned like health or climate. But most startups aren't operating there for a B2B SAS or consumer tech company. Forcing impact into the core model early can distort decision making. The real risk is survivorship bias."
        },
        {
            speaker: "AI_2",
            text: "I think we need to separate two things. There's 'impact-as-the-core-product', which we see in climate-tech, and then there's 'impact-as-a-guardrail'. For most startups, the immediate goal has to be building a sustainable business. You can't leverage your platform for good if it doesn't survive."
        },
        {
            speaker: "AI_3",
            text: "I agree that minimizing harm is crucial, but let's be pragmatic about implementation. The real bottleneck is measurement. It's easy to track Monthly Recurring Revenue, but how do you quantify a negative externality like 'decreased worker security' into a KPI?"
        },
        {
            speaker: "User",
            text: "I want to add a constant here, even if impact isn't a KPI. It still matters as a design time risk control early decisions, data use labor practices, dark patterns, get logged in cheaply at the start and become very expensive to unwind later. So it's not impact versus revenue. It's avoiding irreversible harm while chasing product market fit."
        },
        {
            speaker: "AI_4",
            text: "I think the market is actually starting to solve this for us. We're discussing this as if it's purely an internal founder or VC choice, but the demand side is shifting. Customers and, critically, top-tier talent are now actively choosing companies based on values. Ignoring your societal impact is no longer a soft 'ethical' problem; it's becoming a hard business risk."
        }
    ]
};

async function testAnalyzeSession() {
    console.log('🧪 Testing /v4/analyze-session endpoint...\n');
    console.log('📌 Topic:', testData.topic);
    console.log('👤 User:', testData.userName);
    console.log('⏱️  Duration:', testData.totalDuration);
    console.log('📊 Total turns:', testData.transcript.length);
    console.log('🗣️  User turns:', testData.transcript.filter(t => t.speaker === 'User').length);
    console.log('\n' + '='.repeat(60) + '\n');

    try {
        const response = await fetch('http://localhost:3000/v4/analyze-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP Error:', response.status, response.statusText);
            console.error('Response:', errorText);
            return;
        }

        const result = await response.json();

        if (result.success) {
            console.log('✅ Analysis successful!\n');
            console.log('📊 Session Overview:');
            console.log(JSON.stringify(result.sessionOverview, null, 2));
            console.log('\n📈 Analysis Result:');
            console.log(JSON.stringify(result.analysis, null, 2));
        } else {
            console.error('❌ Analysis failed:', result.error);
        }

    } catch (error) {
        console.error('❌ Request failed:', error.message);
        console.log('\n💡 Make sure the server is running: npm start');
    }
}

// Run the test
testAnalyzeSession();
