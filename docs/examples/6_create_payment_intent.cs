using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class CreatePaymentIntentExample {
    public static async Task CreatePaymentIntent() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var content = new StringContent(
                JsonSerializer.Serialize({"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"}),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.postAsync("/payments/create-intent", content);
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        CreatePaymentIntent().Wait();
    }
}