using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class CreateCourseExample {
    public static async Task CreateCourse() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var content = new StringContent(
                JsonSerializer.Serialize({"title":"Advanced TypeScript","description":"Master TypeScript type system and advanced patterns.","category":"programming","level":"advanced","price":5999}),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.postAsync("/courses", content);
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        CreateCourse().Wait();
    }
}